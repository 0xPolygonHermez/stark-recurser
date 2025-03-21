pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/fp5.circom";

template Sign() {
    signal input a[5];
    signal output a_sign <== SignFp5()(a);
}

component main = Sign();