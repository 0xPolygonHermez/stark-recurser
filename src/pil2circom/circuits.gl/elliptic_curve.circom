pragma circom 2.2.0;

include "mux1.circom";

include "fp5.circom";

/*
    Circuits that implement operations for the elliptic curve 
                    E: y² = x³ + Ax + B
    defined over the extension field Fp⁵ = F[X]/(X⁵-3)
*/

bus PointFp5(){
    signal x[5];
    signal y[5];
}

// Given P,Q,R ∈ E(Fp⁵), checks R == P+Q
// It assumes P,Q,R != 𝒪, Q != P,-P
template AddECFp5() {
    input PointFp5() P;
    input PointFp5() Q;
    output PointFp5() R;

    signal slope_num[5] <== SubFp5()(Q.y, P.y);
    signal slope_den[5] <== SubFp5()(Q.x, P.x);
    signal slope[5] <== DivFp5()(slope_num, slope_den);

    signal slope_sq[5] <== SquareFp5()(slope);
    signal xRa[5] <== SubFp5()(slope_sq, P.x);
    R.x <== SubFp5()(xRa, Q.x);

    signal xdiff[5] <== SubFp5()(P.x, R.x);
    signal yRa[5] <== MulFp5()(slope, xdiff);
    R.y <== SubFp5()(yRa, P.y);
}

// Given x,y ∈ Fp⁵ and S ∈ E(Fp⁵), checks S == hash_to_curve(x,y)
// It inherits the assumptions of MapToCurve, AddECFp5 and ClearCofactor
template HashToCurve(A, B, Z) {
    signal input x[5];
    signal input y[5];
    output PointFp5() S;

    PointFp5() P <== MapToCurve(A, B, Z)(x); // P != 𝒪 by assumption
    PointFp5() Q <== MapToCurve(A, B, Z)(y); // Q != 𝒪 by assumption
    PointFp5() R <== AddECFp5()(P, Q);       // Q != P,-P and R != 𝒪 by assumption
    S <== ClearCofactor()(R);                // ord(R) > h and S != 𝒪 by assumption
}

// Given a ∈ Fp⁵ and R ∈ E(Fp⁵), checks R == map_to_curve(a)
// It assumes R != 𝒪
template MapToCurve(A, B, Z) {
    signal input u[5];
    output PointFp5() R;

    signal tv1a[5] <== SquareFp5()(u);     // tv1 = u²
    signal tv1[5] <== MulFp5()(Z, tv1a);   // tv1 = Z·u²
    signal tv2a[5] <== SquareFp5()(tv1);   // tv2 = Z²·u⁴
    signal tv2b[5] <== AddFp5()(tv2a, tv1); // tv2 = Z²·u⁴ + Z·u²
    signal tv3[5] <== AddFp5()(tv2b, [1,0,0,0,0]);   // tv3 = Z²·u⁴ + Z·u² + 1 TODO: This can be optimized!

    // If tv2 == 0, define tv4 := Z; otherwise, tv4 := -tv2
    signal {binary} tv2_is_zero <== IsZeroFp5()(tv2b);
    signal tv2_neg[5] <== NegFp5()(tv2b);
    signal tv4a[5] <== MultiMux1(5)([tv2_neg, Z], tv2_is_zero);
    signal tv4[5] <== MulFp5()(A, tv4a);   // tv4 = A·tv4
    signal tv2c[5] <== SquareFp5()(tv3);   // tv2 = (Z²·u⁴ + Z·u² + 1)²
    signal tv6a[5] <== SquareFp5()(tv4);   // tv6 = A²·tv4²
    signal tv5a[5] <== MulFp5()(A, tv6a);   // tv5 = A³·tv4²
    signal tv2d[5] <== AddFp5()(tv2c, tv5a); // tv2 = (Z²·u⁴ + Z·u² + 1)² + A³·tv4²
    signal tv2e[5] <== MulFp5()(tv2d, tv3); // tv2 = (Z²·u⁴ + Z·u² + 1)³ + A³·tv4²·(Z²·u⁴ + Z·u² + 1)
    signal tv6[5] <== MulFp5()(tv6a, tv4); // tv6 = A³·tv4³
    signal tv5[5] <== MulFp5()(B, tv6);   // tv5 = B·A³·tv4³
    signal tv2[5] <== AddFp5()(tv2e, tv5); // tv2 = (Z²·u⁴ + Z·u² + 1)³ + A³·tv4²·(Z²·u⁴ + Z·u² + 1) + B·A³·tv4³

    signal x1[5] <== MulFp5()(tv1, tv3);   // x = Z·u²·(Z²·u⁴ + Z·u² + 1)

    // If (tv2 / tv6) is a square, define y1 := sqrt(tv2 / tv6); 
    // otherwise, y1 := sqrt(Z·(tv2 / tv6))
    signal {binary} is_gx1_square;
    signal y1[5];
    (is_gx1_square, y1) <== SqrtRatioFp5()(tv2, tv6);

    signal y2[5] <== MulFp5()(tv1, u);     // y = Z·u³
    signal y3[5] <== MulFp5()(y2, y1);      // y = Z·u³·y1

    signal x2[5] <== MultiMux1(5)([x1, tv3], is_gx1_square);
    signal y4[5] <== MultiMux1(5)([y3, y1], is_gx1_square);

    signal {binary} e <== SignCompareFp5()(u, y4);
    signal y_neg[5] <== NegFp5()(y4);
    signal y[5] <== MultiMux1(5)([y_neg, y4], e);
    signal x[5] <== DivFp5()(x2, tv4);

    R.x <== x;
    R.y <== y;
}

// Given P,R ∈ E(Fp⁵), checks R = h·P, where h is the cofactor of the curve
// It assumes P,R != 𝒪 and ord(P) > h
template ClearCofactor() {
    input PointFp5() P;
    output PointFp5() R;
}