// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MiningRegistry.sol";
import "./CertificationAuthority.sol";
import "./TransportRegistry.sol";
import "./IndustryConsumer.sol";
import "./SmartGridAnalytics.sol";

/*
    CENTRAL GOVERNANCE FACTORY
    - Deploys all system contracts
    - Authorizes all actors
*/
contract CoalSupplyChainFactory {

    error NotOwner();
    error AlreadyDeployed();
    error InvalidRole();
    error AlreadyRequested();
    error BadConsumerType();
    error InvalidIndex();
    error NotPending();

    address public owner;

    MiningRegistry public mining;
    CertificationAuthority public certification;
    TransportRegistry public transport;
    IndustryConsumer public industry;
    SmartGridAnalytics public smartgrid;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function deployAll() external onlyOwner {
        if (
            address(mining) != address(0) ||
            address(certification) != address(0) ||
            address(transport) != address(0) ||
            address(industry) != address(0) ||
            address(smartgrid) != address(0)
        ) revert AlreadyDeployed();

        mining = new MiningRegistry(address(this));
        certification = new CertificationAuthority(address(this));
        transport = new TransportRegistry(address(this));
        industry = new IndustryConsumer(address(this));
        smartgrid = new SmartGridAnalytics(address(this));

        // allow the domain contracts (and factory itself) to update mining status
        mining.authorizeUpdater(address(certification));
        mining.authorizeUpdater(address(transport));
        mining.authorizeUpdater(address(industry));
    }

    /* Role Authorization */

    function authorizeMiner(address minerAddr) external onlyOwner {
        mining.authorizeMiner(minerAddr);
    }

    function authorizeOfficer(address officer) external onlyOwner {
        certification.authorizeOfficer(officer);
    }

    function authorizeTransporter(address transporter) external onlyOwner {
        // keep TransportRegistry authorization for backwards-compatibility,
        // but transport custody is recorded directly in MiningRegistry.
        mining.authorizeTransporter(transporter);
        transport.authorizeTransporter(transporter);
    }

    function authorizeIndustry(address industryAddr, uint8 consumerType) external onlyOwner {
        // 0 = POWER_PLANT, 1 = MANUFACTURING_UNIT
        if (consumerType > 1) revert BadConsumerType();
        industry.authorizeIndustry(
            industryAddr,
            IndustryConsumer.ConsumerType(consumerType)
        );
    }

    function authorizeGrid(address grid) external onlyOwner {
        smartgrid.authorizeGrid(grid);
    }

    /* Role Requests (on-chain) */

    struct RoleRequest {
        address wallet;
        uint8 role; // 0=miner, 1=certification, 2=transporter, 3=industry, 4=smartgrid
        uint256 requestedAt;
        bool pending;
        // optional consumer type for industry requests (0=POWER_PLANT,1=MANUFACTURING_UNIT).
        // defaults to MANUFACTURING_UNIT when left as 0 and role != industry.
        uint8 consumerType;
    }

    RoleRequest[] public roleRequests;
    mapping(address => mapping(uint8 => uint256)) public requestIndex; // wallet => role => index (1-based, 0 = none)

    event RoleRequested(address indexed wallet, uint8 role, uint256 requestId);
    event RoleApproved(address indexed wallet, uint8 role);
    event RoleRejected(address indexed wallet, uint8 role);

    function requestRole(uint8 role, uint8 consumerType) external {
        if (role > 4) revert InvalidRole();
        if (requestIndex[msg.sender][role] != 0) revert AlreadyRequested();
        uint8 storedType = 0;
        if (role == 3) {
            // only POWER_PLANT(0) or MANUFACTURING_UNIT(1) are valid
            if (consumerType > 1) revert BadConsumerType();
            storedType = consumerType;
        }
        roleRequests.push(
            RoleRequest(msg.sender, role, block.timestamp, true, storedType)
        );
        requestIndex[msg.sender][role] = roleRequests.length;
        emit RoleRequested(msg.sender, role, roleRequests.length - 1);
    }

    function _authorizeByRequest(RoleRequest storage req) internal {
        address wallet = req.wallet;
        uint8 role = req.role;
        if (role == 0) mining.authorizeMiner(wallet);
        else if (role == 1) certification.authorizeOfficer(wallet);
        else if (role == 2) {
            mining.authorizeTransporter(wallet);
            transport.authorizeTransporter(wallet);
        }
        else if (role == 3) {
            uint8 cType = (req.consumerType <= 1) ? req.consumerType : 1;
            industry.authorizeIndustry(
                wallet,
                IndustryConsumer.ConsumerType(cType)
            );
        }
        else if (role == 4) smartgrid.authorizeGrid(wallet);
    }

    function approveRequest(uint256 index) external onlyOwner {
        if (index >= roleRequests.length) revert InvalidIndex();
        RoleRequest storage req = roleRequests[index];
        if (!req.pending) revert NotPending();
        _authorizeByRequest(req);
        requestIndex[req.wallet][req.role] = 0;
        req.pending = false;
        emit RoleApproved(req.wallet, req.role);
    }

    function rejectRequest(uint256 index) external onlyOwner {
        if (index >= roleRequests.length) revert InvalidIndex();
        RoleRequest storage req = roleRequests[index];
        if (!req.pending) revert NotPending();
        requestIndex[req.wallet][req.role] = 0;
        req.pending = false;
        emit RoleRejected(req.wallet, req.role);
    }

    function getRoleRequestCount() external view returns (uint256) {
        return roleRequests.length;
    }
}