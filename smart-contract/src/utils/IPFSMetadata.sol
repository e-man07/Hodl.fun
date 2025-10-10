// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPFSMetadata
 * @dev Utility library for handling IPFS metadata operations
 * @notice Provides functions for IPFS hash validation and URI construction
 */
library IPFSMetadata {
    /// @notice IPFS hash prefix for validation
    string public constant IPFS_PREFIX = "Qm";
    
    /// @notice IPFS URI prefix
    string public constant IPFS_URI_PREFIX = "ipfs://";
    
    /// @notice Standard IPFS hash length (46 characters for base58)
    uint256 public constant IPFS_HASH_LENGTH = 46;

    /// @notice Custom errors
    error InvalidIPFSHash();
    error EmptyHash();

    /**
     * @notice Validate IPFS hash format
     * @param hash IPFS hash to validate
     * @return isValid True if hash is valid IPFS format
     */
    function validateIPFSHash(string memory hash) internal pure returns (bool isValid) {
        bytes memory hashBytes = bytes(hash);
        
        // Check if hash is empty
        if (hashBytes.length == 0) {
            return false;
        }
        
        // Check if hash starts with "Qm" (most common IPFS hash format)
        if (hashBytes.length >= 2) {
            if (hashBytes[0] == 0x51 && hashBytes[1] == 0x6D) { // "Qm" in hex
                return hashBytes.length == IPFS_HASH_LENGTH;
            }
        }
        
        // Check for other IPFS hash formats (CIDv1)
        if (hashBytes.length > 10) {
            return true; // Basic length check for CIDv1
        }
        
        return false;
    }

    /**
     * @notice Convert IPFS hash to full URI
     * @param hash IPFS hash
     * @return uri Full IPFS URI
     */
    function hashToURI(string memory hash) internal pure returns (string memory uri) {
        if (!validateIPFSHash(hash)) {
            revert InvalidIPFSHash();
        }
        return string(abi.encodePacked(IPFS_URI_PREFIX, hash));
    }

    /**
     * @notice Extract IPFS hash from URI
     * @param uri IPFS URI
     * @return hash IPFS hash
     */
    function uriToHash(string memory uri) internal pure returns (string memory hash) {
        bytes memory uriBytes = bytes(uri);
        bytes memory prefixBytes = bytes(IPFS_URI_PREFIX);
        
        if (uriBytes.length <= prefixBytes.length) {
            revert InvalidIPFSHash();
        }
        
        // Check if URI starts with IPFS prefix
        for (uint256 i = 0; i < prefixBytes.length; i++) {
            if (uriBytes[i] != prefixBytes[i]) {
                revert InvalidIPFSHash();
            }
        }
        
        // Extract hash part
        bytes memory hashBytes = new bytes(uriBytes.length - prefixBytes.length);
        for (uint256 i = 0; i < hashBytes.length; i++) {
            hashBytes[i] = uriBytes[i + prefixBytes.length];
        }
        
        hash = string(hashBytes);
        
        if (!validateIPFSHash(hash)) {
            revert InvalidIPFSHash();
        }
    }

    /**
     * @notice Check if string is a valid IPFS URI
     * @param uri URI to check
     * @return isValid True if URI is valid IPFS format
     */
    function isValidIPFSURI(string memory uri) internal pure returns (bool isValid) {
        bytes memory uriBytes = bytes(uri);
        bytes memory prefixBytes = bytes(IPFS_URI_PREFIX);
        
        if (uriBytes.length <= prefixBytes.length) {
            return false;
        }
        
        // Check prefix
        for (uint256 i = 0; i < prefixBytes.length; i++) {
            if (uriBytes[i] != prefixBytes[i]) {
                return false;
            }
        }
        
        // Extract and validate hash
        bytes memory hashBytes = new bytes(uriBytes.length - prefixBytes.length);
        for (uint256 i = 0; i < hashBytes.length; i++) {
            hashBytes[i] = uriBytes[i + prefixBytes.length];
        }
        
        return validateIPFSHash(string(hashBytes));
    }

    /**
     * @notice Create metadata URI with proper formatting
     * @param hash IPFS hash
     * @return metadataURI Properly formatted metadata URI
     */
    function createMetadataURI(string memory hash) internal pure returns (string memory metadataURI) {
        if (bytes(hash).length == 0) {
            revert EmptyHash();
        }
        
        // If hash already includes ipfs:// prefix, return as is
        if (isValidIPFSURI(hash)) {
            return hash;
        }
        
        // Otherwise, validate hash and add prefix
        return hashToURI(hash);
    }
}
