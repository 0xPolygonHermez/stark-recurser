pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/fp5.circom";

template Mul() {
    signal input a[5];
    signal input b[5];
    signal output a_mul_b[5] <== MulFp5()(a, b);
}

component main = Mul();