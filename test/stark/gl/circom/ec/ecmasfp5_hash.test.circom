pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/elliptic_curve.circom";

template EcMasFp5Hash() {
    // Constants for the EcMasFp5 curve
    var A[5] = [3, 0, 0, 0, 0];
    var B[5] = [0, 0, 0, 0, 8];
    var Z[5] = [9, 1, 0, 0, 0];
    var C1[5] = [0, 0, 0, 0, 12297829379609722878];
    var C2[5] = [17696091661387705534, 83405823114097643, 16387838525800286325, 16625873122103441396, 8400871913885497801];

    signal input x[5];
    signal input y[5];
    signal output R[2][5] <== HashToCurve(A, B, Z, C1, C2)(x,y);
}

component main = EcMasFp5Hash();