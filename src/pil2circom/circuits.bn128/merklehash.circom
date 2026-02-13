pragma circom 2.1.0;

include "linearhash.circom";
include "merkle.circom";
include "utils.circom";
include "selectval.circom";
include "poseidon.circom";

/*
    Given a set of leaf values, their sibling path and their key, calculate the merkle tree root 
    - eSize: Size of the extended field (usually it will be either 3 if we are in Fp³ or 1)
    - elementsInLinear: Each leave of the merkle tree is made by this number of values. 
*/
template MerkleHash(eSize, elementsInLinear, nLinears, arity) {
    var nBits = log2(nLinears);
    var logArity = log2(arity);
    var nLevels = (nBits - 1)\logArity +1;
    signal input values[elementsInLinear][eSize];
    signal input siblings[nLevels][arity]; // Sibling path to calculate the merkle root given a set of values. 
    signal input {binary} key[nBits]; // Defines either each element of the sibling path is the left or right one
    signal output root; // Root of the merkle tree

    // Each leaf in the merkle tree might be composed by multiple values. Therefore, the first step is to 
    // reduce all those values into a single one by hashing all of them
    signal linearHash <== LinearHash(elementsInLinear, eSize, arity)(values);

    // Calculate the merkle root 
    root <== Merkle(nBits, arity)(linearHash, siblings ,key);
}


/*
    Given a set of leaf values, their sibling path, their key, their merkle root and a boolean, check that the merkle tree root matches with the one sent as input
    - eSize: Size of the extended field (usually it will be either 3 if we are in Fp³ or 1)
    - elementsInLinear: Each leave of the merkle tree is made by this number of values. 
    - nLinears: Number of leaves of the merkle tree
*/
template parallel VerifyMerkleHash(eSize, elementsInLinear, nLinears, arity) {
    var nLeaves = log2(arity);
    var nBits = log2(nLinears);
    assert(1 << nBits == nLinears);
    var nLevels = (nBits - 1)\nLeaves +1;
    signal input values[elementsInLinear][eSize];
    signal input siblings[nLevels][arity]; // Sibling path to calculate the merkle root given a set of values.
    signal input {binary} key[nBits]; // Defines either each element of the sibling path is the left or right one
    signal input root; // Root of the merkle tree
    signal input {binary} enable; // Boolean that determines either we want to check that roots matches or not

    // Calculate the merkle root 
    signal merkleRoot <== MerkleHash(eSize, elementsInLinear, nLinears, arity)(values, siblings, key);

    // If enable is set to 1, check that the merkleRoot being calculated matches with the one sent as input
    enable * (merkleRoot - root) === 0;
}

template VerifyMerkleHashUntilLevel(eSize, elementsInLinear, arity, nLevels, nLastLevels, height) {
    var nBits = log2(arity);
    signal input values[elementsInLinear][eSize]; // Values that are contained in a leaf
    signal input siblings[nLevels][arity]; // Sibling path to calculate the merkle root given a set of values
    signal input {binary} key[nLevels + nLastLevels][nBits]; // Defines either each element of the sibling path is the left or right one
    signal input last_mt_levels[arity**nLastLevels]; // The last levels of the merkle tree, used to optimize the verification process
    signal input {binary} enable; // Boolean that determines either we want to check that roots matches or not

    signal {binary} keys_merkle[nLevels][nBits];
    for (var i=0; i<nLevels; i++) {
        keys_merkle[i] <== key[i];
    }
    
    // Calculate nLinears from the parameters
    var nLinears = arity ** (nLevels + nLastLevels);
    signal calculatedVal <== MerkleHash(eSize, elementsInLinear, nLinears, arity)(values, siblings, keys_merkle);
    
    signal last_levels_keys[nLastLevels][nBits];
    for (var i=0; i<nLastLevels; i++) {
        for (var j=0; j<nBits; j++) {
            last_levels_keys[i][j] <== key[nLevels + i][j];
        }
    }

    var num_nodes_level = height;
    while (num_nodes_level > arity ** nLastLevels) {
        num_nodes_level = (num_nodes_level + (arity - 1)) \ arity;
    }

    signal expectedVal <== SelectValue(arity, nLastLevels, num_nodes_level)(last_mt_levels, last_levels_keys);

    // If enable is set to 1, check that the expectedRoot being calculated matches with the one sent as input
    enable * (calculatedVal - expectedVal) === 0;
}

template VerifyMerkleHashUntilLevelEmpty(eSize, elementsInLinear, arity, nLastLevels, height) {
    var nBits = log2(arity);
    signal input values[elementsInLinear][eSize]; // Values that are contained in a leaf
    signal input {binary} key[nLastLevels][nBits]; // Defines either each element of the sibling path is the left or right one
    signal input last_mt_levels[arity**nLastLevels]; // The last levels of the merkle tree, used to optimize the verification process
    signal input {binary} enable; // Boolean that determines either we want to check that roots matches or not
    
    signal calculatedVal <== LinearHash(elementsInLinear, eSize, arity)(values);

    signal last_levels_keys[nLastLevels][nBits];
    for (var i=0; i<nLastLevels; i++) {
        for (var j=0; j<nBits; j++) {
            last_levels_keys[i][j] <== key[i][j];
        }
    }

    var num_nodes_level = height;
    while (num_nodes_level > arity ** nLastLevels) {
        num_nodes_level = (num_nodes_level + (arity - 1)) \ arity;
    }

    signal expectedVal <== SelectValue(arity, nLastLevels, num_nodes_level)(last_mt_levels, last_levels_keys);

    // If enable is set to 1, check that the expectedRoot being calculated matches with the one sent as input
    enable * (calculatedVal - expectedVal) === 0;
}

template VerifyMerkleRoot(nLevels, arity, height) {
    signal input mt_values[arity**nLevels];
    signal input root;
    signal input {binary} enable;

    var num_nodes_level = height;
    while (num_nodes_level > arity ** nLevels) {
        num_nodes_level = (num_nodes_level + (arity - 1)) \ arity;
    }

    signal calculatedRoot <== CalculateLevelMT(nLevels, arity, num_nodes_level)(mt_values);

    // If enable is set to 1, check that the merkleRoot being calculated matches with the one sent as input
    enable * (calculatedRoot - root) === 0;
}

template CalculateLevelMT(nLevels, arity, num_nodes_level) {
    signal input values[arity**nLevels];
    signal output root;

    if (nLevels == 0) {
        root <== values[0];
    } else {
        var next_n = (num_nodes_level + (arity -  1)) \ arity;
        component hashes[next_n];

        component mNext = CalculateLevelMT(nLevels - 1, arity, next_n);
       
        for (var j = 0; j < next_n; j++) {
            hashes[j] = Poseidon(arity);
            for (var a = 0; a < arity; a++) {
                hashes[j].inputs[a] <== values[arity * j + a];
            }
            mNext.values[j] <== hashes[j].out;
        }

        for (var k = next_n; k < arity**(nLevels - 1); k++) {
            mNext.values[k] <== 0;
        }
        root <== mNext.root;
    }
}