pragma circom 2.2.0;

include "../../../../src/pil2circom/circuits.gl/fp.circom";

template Fp() {
    signal input a;
    signal output is_square;

    is_square <== IsSquareFp()(a);
}

component main = Fp();