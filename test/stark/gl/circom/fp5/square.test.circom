pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/fp5.circom";

template Square() {
    signal input a[5];
    signal output a_square[5] <== SquareFp5()(a);
}

component main = Square();