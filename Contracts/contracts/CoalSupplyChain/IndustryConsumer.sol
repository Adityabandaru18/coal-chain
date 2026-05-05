// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MiningRegistry.sol";

/*
    INDUSTRY CONSUMER
    - Final consumption stage
*/

contract IndustryConsumer {

    address public factory;

    // Types of industrial consumers. Stored per authorized wallet.
    enum ConsumerType {
        POWER_PLANT,
        MANUFACTURING_UNIT
    }

    constructor(address _factory) {
        factory = _factory;
    }

    mapping(address => bool) public authorizedIndustry;
    mapping(address => ConsumerType) public consumerTypes;
    uint256 public authorizedIndustryCount;

    // Simple per-batch consumption record used by both manufacturing units and power plants.
    struct ConsumptionRecord {
        uint256 batchId;
        address consumer;
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint256 createdAt;
        uint256 quantityBurned;
        uint256 calorificValue;
        uint256 claimedGeneration; // kWh
    }

    // Mapping batchId => consumption record (single record per batch for now)
    mapping(uint256 => ConsumptionRecord) public consumptionRecords;
    uint256 public totalConsumptionRecords;

    event ConsumerAuthorized(address indexed wallet, ConsumerType consumerType);
    event BatchConsumed(
        uint256 indexed batchId,
        address indexed consumer,
        ConsumerType consumerType,
        uint256 startTimestamp,
        uint256 endTimestamp,
        uint256 quantityBurned,
        uint256 calorificValue,
        uint256 claimedGeneration
    );

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyIndustry() {
        require(authorizedIndustry[msg.sender], "Not industry");
        _;
    }

    function authorizeIndustry(address industryAddr, ConsumerType cType) external onlyFactory {
        if (!authorizedIndustry[industryAddr]) {
            authorizedIndustry[industryAddr] = true;
            consumerTypes[industryAddr] = cType;
            authorizedIndustryCount++;
            emit ConsumerAuthorized(industryAddr, cType);
        } else {
            // allow factory to upgrade / correct the consumer type
            consumerTypes[industryAddr] = cType;
            emit ConsumerAuthorized(industryAddr, cType);
        }
    }

    function getConsumerType(address wallet) external view returns (ConsumerType) {
        return consumerTypes[wallet];
    }

    /**
     * Records consumption of a delivered batch by an industrial consumer.
     * For POWER_PLANT, the Smart Grid operator will later attach generation data
     * via the SmartGridAnalytics contract.
     */
    function consumeBatch(
        address miningAddress,
        uint256 batchId,
        uint256 startTimestamp,
        uint256 endTimestamp,
        uint256 quantityBurned,
        uint256 calorificValue,
        uint256 claimedGeneration
    ) external onlyIndustry {
        // Validation moved to allow Manufacturing Units to also consume if needed,
        // but typically only Power Plants log metrics.
        
        MiningRegistry mining = MiningRegistry(miningAddress);

        MiningRegistry.BatchStatus status = mining.getStatus(batchId);
        require(
            status == MiningRegistry.BatchStatus.Received,
            "Must confirm receipt (Received status) before consumption"
        );

        mining.updateStatus(
            batchId,
            MiningRegistry.BatchStatus.Consumed
        );

        ConsumptionRecord storage rec = consumptionRecords[batchId];
        // allow a single logical record per batch; do not overwrite if already present
        require(rec.createdAt == 0, "Already consumed");

        rec.batchId = batchId;
        rec.consumer = msg.sender;
        rec.startTimestamp = startTimestamp;
        rec.endTimestamp = endTimestamp;
        rec.createdAt = block.timestamp;
        rec.quantityBurned = quantityBurned;
        rec.calorificValue = calorificValue;
        rec.claimedGeneration = claimedGeneration;

        totalConsumptionRecords++;

        emit BatchConsumed(
            batchId,
            msg.sender,
            consumerTypes[msg.sender],
            startTimestamp,
            endTimestamp,
            quantityBurned,
            calorificValue,
            claimedGeneration
        );
    }

    function confirmDelivery(
        address miningAddress,
        uint256 batchId
    ) external onlyIndustry {
        MiningRegistry mining = MiningRegistry(miningAddress);
        mining.confirmDelivery(batchId, msg.sender);
    }

    function reportNonDelivery(
        address miningAddress,
        uint256 batchId,
        address transporter,
        string calldata reasonHash
    ) external onlyIndustry {
        MiningRegistry mining = MiningRegistry(miningAddress);
        mining.raiseDispute(batchId, msg.sender, transporter, reasonHash);
    }
}