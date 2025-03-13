pragma circom 2.2.0;

include "fp5.circom";

/*
    Circuits that implement operations for the elliptic curve 
                    E: y² = x³ + Ax + B
    defined over the extension field Fp⁵ = F[X]/(X⁵-3)
*/

// Given P,Q,R ∈ E(Fp⁵), checks R == P+Q
// It assumes P,Q,R != 𝒪, Q != P,-P
template AddECFp5() {
    signal input P[2][5];
    signal input Q[2][5];
    signal output R[2][5];

    signal slope_num[5] <== SubFp5()(Q[1], P[1]);
    signal slope_den[5] <== SubFp5()(Q[0], P[0]);
    signal slope[5] <== DivFp5()(slope_num, slope_den);

    signal slope_sq[5] <== SquareFp5()(slope);
    signal xRa[5] <== SubFp5()(slope_sq, P[0]);
    R[0] <== SubFp5()(xRa, Q[0]);

    signal xdiff[5] <== SubFp5()(P[0], R[0]);
    signal yRa[5] <== MulFp5()(slope, xdiff);
    R[1] <== SubFp5()(yRa, P[1]);
}

// Given x,y ∈ Fp⁵ and S ∈ E(Fp⁵), checks S == hash_to_curve(x,y)
// It inherits the assumptions of MapToCurve, AddECFp5 and ClearCofactor
template HashToCurve(A, B) {
    signal input x[5];
    signal input y[5];
    signal output S[2][5];

    signal P[2][5] <== MapToCurve(A, B)(x); // P != 𝒪 by assumption
    signal Q[2][5] <== MapToCurve(A, B)(y); // Q != 𝒪 by assumption
    signal R[2][5] <== AddECFp5()(P, Q);    // Q != P,-P and R != 𝒪 by assumption
    S <== ClearCofactor()(R);               // ord(R) > h and S != 𝒪 by assumption
}

// Given x ∈ Fp⁵ and R ∈ E(Fp⁵), checks R == map_to_curve(x)
// It assumes R != 𝒪
template MapToCurve(A, B) {
    signal input x[5];
    signal output R[2][5];
}

// Given P,R ∈ E(Fp⁵), checks R = h·P, where h is the cofactor of the curve
// It assumes P,R != 𝒪 and ord(P) > h
template ClearCofactor() {
    signal input P[2][5];
    signal output R[2][5];
}