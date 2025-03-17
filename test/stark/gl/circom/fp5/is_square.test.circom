pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/fp5.circom";

template IsSquare() {
    signal input a[5];
    signal output a_pow;
    signal output {binary} a_is_square;
    (a_pow, a_is_square) <== IsSquareFp5()(a);
}

component main = IsSquare();