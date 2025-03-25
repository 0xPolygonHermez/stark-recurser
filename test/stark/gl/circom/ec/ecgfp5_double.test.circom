pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/elliptic_curve.circom";

template ECDouble() {
    var A[5] = [6148914689804861439, 263, 0, 0, 0];

    signal input P[2][5];
    signal output R[2][5] <== DoubleECFp5(A)(P);
}

component main = ECDouble();