pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/fp5.circom";

template Div() {
    signal input a[5];
    signal input b[5];
    signal output a_div_b[5] <== DivFp5()(a, b);
}

component main = Div();