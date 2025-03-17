pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/fp5.circom";

template Add() {
    signal input a[5];
    signal input b[5];
    signal output a_plus_b[5] <== AddFp5()(a, b);
}

component main = Add();