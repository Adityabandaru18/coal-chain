// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SmartGridAnalytics {

    address public factory;

    constructor(address _factory) {
        factory = _factory;
    }

    mapping(address => bool) public authorizedGrids;
    uint256 public authorizedGridCount;

    // On-chain generation / efficiency records per batch, created by authorized grid operators.
    struct GridRecord {
        bytes32 batchId;
        address powerPlant;
        uint256 quantityConsumed;
        uint256 caloricValue;
        uint256 expectedOutputKWh;
        uint256 actualGeneratedKWh;
        uint256 gridLoadServedKWh;
        uint256 efficiencyRatio; // scaled x100
        uint256 recordedAt;
        bool discrepancyFlagged;
    }

    // batchId (as bytes32) => record
    mapping(bytes32 => GridRecord) public gridRecords;
    uint256 public totalGridRecords;

    // configurable efficiency threshold (scaled x100)
    // Thermal efficiency for coal plants is typically 30-45%.
    uint256 public efficiencyThresholdX100 = 30; // default 30%

    event GridAudit(address grid);
    event GridRecordAdded(
        bytes32 indexed batchId,
        address indexed powerPlant,
        uint256 actualGeneratedKWh,
        uint256 expectedOutputKWh,
        uint256 efficiencyRatio,
        bool discrepancyFlagged
    );

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyGrid() {
        require(authorizedGrids[msg.sender], "Not grid");
        _;
    }

    function authorizeGrid(address grid) external onlyFactory {
        if (!authorizedGrids[grid]) {
            authorizedGrids[grid] = true;
            authorizedGridCount++;
        }
    }

    function recordAudit() external onlyGrid {
        emit GridAudit(msg.sender);
    }

    /**
     * Owner can tune the minimum acceptable efficiency ratio (x100).
     */
    function setEfficiencyThreshold(uint256 newThresholdX100) external onlyFactory {
        require(newThresholdX100 > 0 && newThresholdX100 <= 10000, "Invalid threshold");
        efficiencyThresholdX100 = newThresholdX100;
    }

    /**
     * Records generation metrics for a consumed batch.
     * expectedOutputKWh and efficiencyRatio are auto-derived inside this function to keep
     * governance logic on-chain and tamper-evident.
     *
     * @param batchIdBytes       batchId encoded as bytes32
     * @param powerPlant         wallet of the power plant consumer
     * @param quantityConsumed   tons of coal consumed (reported by plant)
     * @param caloricValue       calorific value (certified figure)
     * @param verifiedElectricityKWh generation verified by grid instruments (SGO input)
     * @param gridLoadServedKWh  grid load served in kWh
     */
    function addGridRecord(
        bytes32 batchIdBytes,
        address powerPlant,
        uint256 quantityConsumed,
        uint256 caloricValue,
        uint256 verifiedElectricityKWh,
        uint256 gridLoadServedKWh
    ) external onlyGrid {
        require(batchIdBytes != bytes32(0), "Invalid batch id");
        require(quantityConsumed > 0, "Zero quantity");
        require(caloricValue > 0, "Zero caloric value");
        require(verifiedElectricityKWh > 0, "Zero generation");

        GridRecord storage rec = gridRecords[batchIdBytes];
        require(rec.recordedAt == 0, "Already recorded");

        // Simple expected output model: quantity * caloric value
        // Note: quantity (tons) * caloricValue (kcal/kg) / conversion_factor = KWh
        // We assume caloricValue here is already scaled to include the conversion to kWh
        uint256 expectedOutputKWh = quantityConsumed * caloricValue;
        uint256 efficiencyRatio = (verifiedElectricityKWh * 100) / expectedOutputKWh;
        bool discrepancy = efficiencyRatio < efficiencyThresholdX100;

        rec.batchId = batchIdBytes;
        rec.powerPlant = powerPlant;
        rec.quantityConsumed = quantityConsumed;
        rec.caloricValue = caloricValue;
        rec.expectedOutputKWh = expectedOutputKWh;
        rec.actualGeneratedKWh = verifiedElectricityKWh; // SGO's verified figure
        rec.gridLoadServedKWh = gridLoadServedKWh;
        rec.efficiencyRatio = efficiencyRatio;
        rec.recordedAt = block.timestamp;
        rec.discrepancyFlagged = discrepancy;

        totalGridRecords++;

        emit GridRecordAdded(
            batchIdBytes,
            powerPlant,
            verifiedElectricityKWh,
            expectedOutputKWh,
            efficiencyRatio,
            discrepancy
        );
    }
}