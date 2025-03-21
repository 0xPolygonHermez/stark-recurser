pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/elliptic_curve.circom";

template EcGFp5Hash() {
    // Constants for the EcGFp5 curve
    var A[5] = [6148914689804861439, 263, 0, 0, 0];
    var B[5] = [15713893096167979237, 6148914689804861265, 0, 0, 0];
    var Z[5] = [18446744069414584317, 18446744069414584320, 0, 0, 0];
    var C1[5] = [6585749426319121644, 16990361517133133838, 3264760655763595284, 16784740989273302855, 13434657726302040770];
    var C2[5] = [4795794222525505369, 3412737461722269738, 8370187669276724726, 7130825117388110979, 12052351772713910496];

    signal input x[5];
    signal input y[5];
    signal output R[2][5] <== HashToCurve(A, B, Z, C1, C2)(x,y);
}

component main = EcGFp5Hash();