pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/fp5.circom";

template IsZero() {
    signal input a[5];
    signal output a_is_zero <== IsZeroFp5()(a);
}

component main = IsZero();