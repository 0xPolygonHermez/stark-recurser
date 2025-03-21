pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/fp5.circom";

template Sqrt() {
    signal input a[5];
    signal output a_sqrt[5] <== SqrtFp5()(a);
}

component main = Sqrt();