pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/fp5.circom";

template SignCompare() {
    signal input a[5];
    signal input b[5];
    signal output a_sign_b <== SignCompareFp5()(a, b);
}

component main = SignCompare();