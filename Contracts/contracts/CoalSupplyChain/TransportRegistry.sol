// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MiningRegistry.sol";

/*
    TRANSPORT REGISTRY
    - Tracks custody transitions
*/

contract TransportRegistry {

    address public factory;

    constructor(address _factory) {
        factory = _factory;
    }

    mapping(address => bool) public authorizedTransporters;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyTransporter() {
        require(authorizedTransporters[msg.sender], "Not transporter");
        _;
    }

    function authorizeTransporter(address transporter)
        external
        onlyFactory
    {
        authorizedTransporters[transporter] = true;
    }

    function markInTransit(address miningAddress, uint256 batchId)
        external
        onlyTransporter
    {
        MiningRegistry mining = MiningRegistry(miningAddress);

        require(
            mining.getStatus(batchId) ==
                MiningRegistry.BatchStatus.Certified,
            "Not certified"
        );

        mining.updateStatus(
            batchId,
            MiningRegistry.BatchStatus.InTransit
        );
    }

    function markDelivered(address miningAddress, uint256 batchId)
        external
        onlyTransporter
    {
        MiningRegistry mining = MiningRegistry(miningAddress);

        require(
            mining.getStatus(batchId) ==
                MiningRegistry.BatchStatus.InTransit,
            "Not in transit"
        );

        mining.updateStatus(
            batchId,
            MiningRegistry.BatchStatus.Delivered
        );
    }
}