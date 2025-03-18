pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/elliptic_curve.circom";

template ECAdd() {
    signal input P[2][5];
    signal input Q[2][5];
    signal output R[2][5] <== AddECFp5()(P,Q);
}

component main = ECAdd();