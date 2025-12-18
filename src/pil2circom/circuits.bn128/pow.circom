pragma circom 2.1.0;
pragma custom_templates;

include "poseidon.circom";
include "bitify.circom";

template VerifyPoW(powBits) {
    signal input challengeFRIQueries[3];
    signal input nonce;
    signal input {binary} enable;

    component hash = Poseidon(4);
    hash.inputs[0] <== challengeFRIQueries[0];
    hash.inputs[1] <== challengeFRIQueries[1];
    hash.inputs[2] <== challengeFRIQueries[2];
    hash.inputs[3] <== nonce; 
    
    signal bits[254] <== Num2Bits_strict()(hash.out);
    for (var i = 253; i >= 254 - powBits; i--) {
        bits[i] === 0;
    }

    for (var i = 254 - powBits - 1; i >= 0; i--) {
        _ <== bits[i];
    }
}