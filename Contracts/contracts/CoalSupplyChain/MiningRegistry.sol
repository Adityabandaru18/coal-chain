// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
    MINING REGISTRY
    - Creates coal batches
    - Maintains lifecycle status
    - Only certification authority verifies batches; Certified status means verified
*/

contract MiningRegistry {

    address public factory;

    mapping(address => bool) public authorizedUpdaters;
    mapping(address => bool) public authorizedTransporters;

    error Unauthorized();
    error NotMiner();
    error NotTransporter();
    error NotAuthorizedUpdater();
    error OnlyFactory();
    error InvalidBatch();
    error InvalidQuantity();
    error AlreadyHandled();
    error StatusMismatch();
    error InvalidETA();
    error AlreadyConsumed();
    error AlreadyDelivered();
    error NotInTransit();
    error NoReason();
    error AlreadyResolved();

    constructor(address _factory) {
        factory = _factory;
        authorizedUpdaters[_factory] = true;
    }

    // Full on-chain lifecycle for a coal batch.
    // NOTE: Index ordering is relied on by the frontend analytics library.
    enum BatchStatus {
        Created,             // 0
        Certified,           // 1
        TransportRequested,  // 2 - miner has requested transport for a certified batch
        InTransit,           // 3 - transporter has accepted and picked up
        Delivered,           // 4 - transporter claims delivery completed
        Consumed,            // 5 - consumer has logged consumption
        Disputed,            // 6 - consumer has disputed delivery
        Rejected,            // 7 - certification authority has rejection authority
        Received             // 8 - consumer has confirmed receipt
    }

    struct CoalBatch {
        uint256 id;
        address miner;
        string location;
        string grade;
        uint256 quantity;
        uint256 timestamp;
        BatchStatus status;
    }

    struct TransportRecord {
        address transporter;
        uint256 pickupTime;
        uint256 deliveryTime;
    }

    // Request raised by an industrial consumer against a certified batch.
    struct CoalRequest {
        uint256 id;
        uint256 batchId;
        address consumer;
        string destination;
        string grade;
        uint8 consumerType; // 0 = POWER_PLANT, 1 = MANUFACTURING_UNIT
        address assignedTransporter;
        uint256 expectedDeliveryAt;
        bool accepted;
        bool cancelled;
        uint256 createdAt;
    }

    // Dispute raised by consumer if a transporter falsely claims delivery.
    struct DeliveryDispute {
        uint256 id;
        uint256 batchId;
        address transporter;
        address consumer;
        uint256 raisedAt;
        string reasonHash;
        bool resolved;
        string resolutionNote;
    }

    uint256 public batchCounter;
    uint256 public totalQuantity;
    uint256 public minerCount;
    uint256 public authorizedMinerCount;
    uint256 public authorizedTransporterCount;
    uint256 public deliveredQuantity;

    mapping(uint256 => CoalBatch) public batches;
    mapping(uint256 => TransportRecord) public transportRecords;
    mapping(uint256 => CoalRequest) public coalRequests;
    mapping(uint256 => DeliveryDispute) public disputes;
    mapping(uint256 => uint256[]) public disputesByBatch;

    uint256 public coalRequestCounter;
    uint256 public disputeCounter;
    mapping(address => bool) public authorizedMiners;
    mapping(address => bool) private _hasCreatedBatch;

    // global batch counts per status
    mapping(uint8 => uint256) public statusCount;
    mapping(address => uint256) public minerTotalQuantity;
    mapping(address => mapping(uint8 => uint256)) public minerStatusCount;
    mapping(address => uint256) public activeTransportCount;
    mapping(address => uint256) public completedTransportCount;

    event BatchCreated(uint256 id);
    event StatusUpdated(uint256 id, BatchStatus status);
    event TransportStarted(uint256 batchId, address transporter);
    event TransportCompleted(uint256 batchId, address transporter);
    event CoalRequested(uint256 indexed requestId, uint256 indexed batchId, address indexed consumer);
    event TransportAssigned(uint256 indexed requestId, address indexed transporter);
    event TransportAccepted(uint256 indexed requestId, address indexed transporter, uint256 expectedDeliveryAt);
    event TransportRejected(uint256 indexed requestId, address indexed transporter);
    event DeliveryMarked(uint256 indexed batchId, uint256 indexed requestId, address indexed transporter);
    event DeliveryConfirmed(uint256 indexed batchId, address indexed consumer);
    event DeliveryDisputed(uint256 indexed disputeId, uint256 indexed batchId, address indexed consumer);
    event DisputeResolved(uint256 indexed disputeId, string resolutionNote);

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    modifier onlyMiner() {
        if (!authorizedMiners[msg.sender]) revert NotMiner();
        _;
    }

    modifier onlyTransporter() {
        if (!authorizedTransporters[msg.sender]) revert NotTransporter();
        _;
    }

    modifier onlyAuthorizedUpdater() {
        if (!authorizedUpdaters[msg.sender]) revert NotAuthorizedUpdater();
        _;
    }

    function authorizeMiner(address minerAddr) external onlyFactory {
        if (!authorizedMiners[minerAddr]) {
            authorizedMiners[minerAddr] = true;
            authorizedMinerCount++;
        }
    }

    function authorizeTransporter(address transporterAddr) external onlyFactory {
        if (!authorizedTransporters[transporterAddr]) {
            authorizedTransporters[transporterAddr] = true;
            authorizedTransporterCount++;
        }
    }

    function authorizeUpdater(address updater) external onlyFactory {
        authorizedUpdaters[updater] = true;
    }

    function createCoalBatch(
        string calldata location,
        string calldata grade,
        uint256 quantity
    ) external onlyMiner {

        if (quantity == 0) revert InvalidQuantity();

        batchCounter++;
        totalQuantity += quantity;
        statusCount[uint8(BatchStatus.Created)]++;

        if (!_hasCreatedBatch[msg.sender]) {
            _hasCreatedBatch[msg.sender] = true;
            minerCount++;
        }
        minerTotalQuantity[msg.sender] += quantity;
        minerStatusCount[msg.sender][uint8(BatchStatus.Created)]++;

        batches[batchCounter] = CoalBatch(
            batchCounter,
            msg.sender,
            location,
            grade,
            quantity,
            block.timestamp,
            BatchStatus.Created
        );

        emit BatchCreated(batchCounter);
    }

    function _setStatus(uint256 batchId, BatchStatus newStatus) private {
        BatchStatus oldStatus = batches[batchId].status;
        address minerAddr = batches[batchId].miner;
        uint256 qty = batches[batchId].quantity;
        if (oldStatus != newStatus) {
            statusCount[uint8(oldStatus)]--;
            statusCount[uint8(newStatus)]++;
            minerStatusCount[minerAddr][uint8(oldStatus)]--;
            minerStatusCount[minerAddr][uint8(newStatus)]++;
            if (newStatus == BatchStatus.Delivered || newStatus == BatchStatus.Received || newStatus == BatchStatus.Consumed) {
                deliveredQuantity += qty;
            } else if (oldStatus == BatchStatus.Delivered || oldStatus == BatchStatus.Received || oldStatus == BatchStatus.Consumed) {
                // if a dispute or other transition moves the batch out of Delivered/Received/Consumed,
                // keep the aggregate consistent
                deliveredQuantity -= qty;
            }
        }
        batches[batchId].status = newStatus;
        emit StatusUpdated(batchId, newStatus);
    }

    function updateStatus(uint256 batchId, BatchStatus newStatus)
        external
        onlyAuthorizedUpdater
    {
        if (batchId == 0 || batchId > batchCounter) revert InvalidBatch();
        _setStatus(batchId, newStatus);
    }

    function getStatus(uint256 batchId)
        external
        view
        returns (BatchStatus)
    {
        return batches[batchId].status;
    }

    /**
     * INDUSTRIAL CONSUMER: create a coal request against a certified batch.
     */
    function createCoalRequest(
        uint256 batchId,
        string calldata destination,
        uint8 consumerType
    ) external {
        if (batchId == 0 || batchId > batchCounter) revert InvalidBatch();
        CoalBatch storage b = batches[batchId];
        if (b.status != BatchStatus.Certified) revert StatusMismatch();
        if (consumerType > 1) revert Unauthorized();

        coalRequestCounter++;
        CoalRequest storage r = coalRequests[coalRequestCounter];
        r.id = coalRequestCounter;
        r.batchId = batchId;
        r.consumer = msg.sender;
        r.destination = destination;
        r.grade = b.grade;
        r.consumerType = consumerType;
        r.createdAt = block.timestamp;

        emit CoalRequested(coalRequestCounter, batchId, msg.sender);
    }

    /**
     * MINER: assign a transporter for a given request.
     */
    function assignTransporter(
        uint256 requestId,
        address transporter
    ) external {
        CoalRequest storage r = coalRequests[requestId];
        if (r.id == 0) revert AlreadyHandled(); // Or InvalidRequest
        CoalBatch storage b = batches[r.batchId];
        if (b.miner != msg.sender) revert NotMiner();
        if (b.status != BatchStatus.Certified && b.status != BatchStatus.TransportRequested) revert StatusMismatch();
        if (r.cancelled || r.accepted) revert AlreadyHandled();
        if (!authorizedTransporters[transporter]) revert NotTransporter();

        r.assignedTransporter = transporter;
        if (b.status == BatchStatus.Certified) {
            _setStatus(r.batchId, BatchStatus.TransportRequested);
        }

        emit TransportAssigned(requestId, transporter);
    }

    /**
     * TRANSPORTER: accept a transport assignment with an expected delivery timestamp.
     */
    function acceptTransport(uint256 requestId, uint256 expectedDeliveryAt) external {
        CoalRequest storage r = coalRequests[requestId];
        if (r.id == 0) revert AlreadyHandled();
        if (r.cancelled || r.accepted) revert AlreadyHandled();
        if (r.assignedTransporter != msg.sender) revert NotTransporter();
        if (expectedDeliveryAt <= block.timestamp) revert InvalidETA();

        r.accepted = true;
        r.expectedDeliveryAt = expectedDeliveryAt;

        TransportRecord storage rec = transportRecords[r.batchId];
        require(rec.pickupTime == 0, "Started");
        rec.transporter = msg.sender;
        rec.pickupTime = block.timestamp;
        rec.deliveryTime = 0;

        activeTransportCount[msg.sender]++;

        _setStatus(r.batchId, BatchStatus.InTransit);
        emit TransportAccepted(requestId, msg.sender, expectedDeliveryAt);
        emit TransportStarted(r.batchId, msg.sender);
    }

    /**
     * TRANSPORTER: reject a specific transport assignment.
     */
    function rejectTransport(uint256 requestId) external {
        CoalRequest storage r = coalRequests[requestId];
        if (r.id == 0) revert AlreadyHandled();
        if (r.cancelled || r.accepted) revert AlreadyHandled();
        if (r.assignedTransporter != msg.sender) revert NotTransporter();

        r.cancelled = true;
        r.assignedTransporter = address(0);

        emit TransportRejected(requestId, msg.sender);
    }

    /**
     * TRANSPORTER: mark delivery complete for a request.
     */
    function markDeliveredFromRequest(uint256 requestId) external {
        CoalRequest storage r = coalRequests[requestId];
        if (r.id == 0) revert AlreadyHandled();
        if (!r.accepted || r.cancelled) revert AlreadyHandled();
        if (r.assignedTransporter != msg.sender) revert NotTransporter();

        uint256 batchId = r.batchId;
        if (batchId == 0 || batchId > batchCounter) revert InvalidBatch();
        if (batches[batchId].status != BatchStatus.InTransit) revert StatusMismatch();

        TransportRecord storage rec = transportRecords[batchId];
        if (rec.transporter != msg.sender) revert NotTransporter();
        if (rec.pickupTime == 0) revert StatusMismatch();
        if (rec.deliveryTime != 0) revert AlreadyDelivered();

        rec.deliveryTime = block.timestamp;

        activeTransportCount[msg.sender]--;
        completedTransportCount[msg.sender]++;

        _setStatus(batchId, BatchStatus.Delivered);
        emit TransportCompleted(batchId, msg.sender);
        emit DeliveryMarked(batchId, requestId, msg.sender);
    }

    /**
     * Called by IndustryConsumer to confirm that delivery was valid.
     * Does not change status (remains Delivered until Consumed), but provides
     * an auditable on-chain signal.
     */
    function confirmDelivery(uint256 batchId, address consumer) external onlyAuthorizedUpdater {
        if (batchId == 0 || batchId > batchCounter) revert InvalidBatch();
        if (batches[batchId].status != BatchStatus.Delivered) revert StatusMismatch();
        
        _setStatus(batchId, BatchStatus.Received);
        emit DeliveryConfirmed(batchId, consumer);
    }

    /**
     * Called by IndustryConsumer when the consumer disputes a delivery.
     * Moves status to Disputed and records an on-chain dispute.
     */
    function raiseDispute(
        uint256 batchId,
        address consumer,
        address transporter,
        string calldata reasonHash
    ) external onlyAuthorizedUpdater {
        if (batchId == 0 || batchId > batchCounter) revert InvalidBatch();
        if (batches[batchId].status != BatchStatus.Delivered) revert StatusMismatch();
        if (bytes(reasonHash).length == 0) revert NoReason();

        disputeCounter++;
        DeliveryDispute storage d = disputes[disputeCounter];
        d.id = disputeCounter;
        d.batchId = batchId;
        d.transporter = transporter;
        d.consumer = consumer;
        d.raisedAt = block.timestamp;
        d.reasonHash = reasonHash;

        disputesByBatch[batchId].push(disputeCounter);

        _setStatus(batchId, BatchStatus.Disputed);
        emit DeliveryDisputed(disputeCounter, batchId, consumer);
    }

    /**
     * ADMIN (factory owner): resolve a dispute with an optional note.
     */
    function resolveDispute(uint256 disputeId, string calldata resolutionNote) external onlyFactory {
        DeliveryDispute storage d = disputes[disputeId];
        if (d.id == 0) revert AlreadyResolved();
        if (d.resolved) revert AlreadyResolved();

        d.resolved = true;
        d.resolutionNote = resolutionNote;

        emit DisputeResolved(disputeId, resolutionNote);
    }
}