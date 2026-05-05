// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MiningRegistry.sol";

/*
    GOVERNMENT CERTIFICATION
    - Certifies coal batches
*/

contract CertificationAuthority {

    address public factory;

    constructor(address _factory) {
        factory = _factory;
    }

    struct Certificate {
        uint256 batchId;
        string certificateHash;
        uint256 issuedAt;
        address issuedBy;
        uint256 calorificValue; // kcal/kg
    }

    struct Rejection {
        uint256 batchId;
        string reasonHash;
        uint256 rejectedAt;
        address rejectedBy;
    }

    mapping(uint256 => Certificate) public certificates;
    mapping(uint256 => Rejection) public rejections;
    mapping(address => bool) public authorizedOfficers;

    uint256 public authorizedOfficerCount;
    uint256 public totalCertificates;
    uint256 public totalRejections;
    mapping(address => uint256) public officerCertCount;
    mapping(address => uint256) public officerRejectCount;

    event BatchRejected(uint256 batchId, string reasonHash, address rejectedBy);

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyOfficer() {
        require(authorizedOfficers[msg.sender], "Not officer");
        _;
    }

    function authorizeOfficer(address officer) external onlyFactory {
        if (!authorizedOfficers[officer]) {
            authorizedOfficers[officer] = true;
            authorizedOfficerCount++;
        }
    }

    function certifyBatch(
        address miningAddress,
        uint256 batchId,
        string calldata certificateHash,
        uint256 calorificValue
    ) external onlyOfficer {

        MiningRegistry mining = MiningRegistry(miningAddress);

        require(
            mining.getStatus(batchId) ==
                MiningRegistry.BatchStatus.Created,
            "Invalid state"
        );

        // prevent overwriting an existing certificate
        require(
            certificates[batchId].issuedAt == 0,
            "Already certified"
        );

        // prevent certifying after rejection
        require(
            rejections[batchId].rejectedAt == 0,
            "Already rejected"
        );

        certificates[batchId] = Certificate(
            batchId,
            certificateHash,
            block.timestamp,
            msg.sender,
            calorificValue
        );
        totalCertificates++;
        officerCertCount[msg.sender]++;

        mining.updateStatus(
            batchId,
            MiningRegistry.BatchStatus.Certified
        );
    }

    function rejectBatch(
        address miningAddress,
        uint256 batchId,
        string calldata reasonHash
    ) external onlyOfficer {
        MiningRegistry mining = MiningRegistry(miningAddress);

        require(
            mining.getStatus(batchId) == MiningRegistry.BatchStatus.Created,
            "Invalid state"
        );

        require(
            certificates[batchId].issuedAt == 0,
            "Already certified"
        );

        require(
            rejections[batchId].rejectedAt == 0,
            "Already rejected"
        );

        rejections[batchId] = Rejection(
            batchId,
            reasonHash,
            block.timestamp,
            msg.sender
        );
        totalRejections++;
        officerRejectCount[msg.sender]++;

        mining.updateStatus(
            batchId,
            MiningRegistry.BatchStatus.Rejected
        );

        emit BatchRejected(batchId, reasonHash, msg.sender);
    }
}