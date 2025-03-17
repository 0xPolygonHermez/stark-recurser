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
template HashToCurve(A, B, Z, C1, C2) {
    signal input x[5];
    signal input y[5];
    output PointFp5() S;

    PointFp5() P <== MapToCurve(A, B, Z, C1, C2)(x); // P != 𝒪 by assumption
    PointFp5() Q <== MapToCurve(A, B, Z, C1, C2)(y); // Q != 𝒪 by assumption
    PointFp5() R <== AddECFp5()(P, Q);       // Q != P,-P and R != 𝒪 by assumption
    S <== ClearCofactor()(R);                // ord(R) > h and S != 𝒪 by assumption
}

// Given a ∈ Fp⁵ and R ∈ E(Fp⁵), checks R == map_to_curve(a)
// It assumes R != 𝒪
template MapToCurve(A, B, Z, C1, C2) {
    signal input u[5];
    output PointFp5() R;

    signal tv1a[5] <== SquareFp5()(u);      // tv1 = u²
    signal tv1[5] <== MulFp5()(Z, tv1a);    // tv1 = Z·u²
    signal tv2a[5] <== SquareFp5()(tv1);    // tv2 = Z²·u⁴

    signal x1a[5] <== AddFp5()(tv2a, tv1);  //  x1 = Z²·u⁴ + Z·u²
    signal {binary} e1;
    signal x1b[5];
    (e1, x1b) <== Inv0Fp5()(x1a); //  e1 = (x1 == 0), x1 = 1 / (Z²·u⁴ + Z·u²)
    signal x1c[5] <== MultiMux1(5)([[x1b[0] + 1, x1b[1], x1b[2], x1b[3], x1b[4]], C2], e1); // If (tv1 + tv2) == 0, set x1 = -1 / Z
    signal x1[5] <== MulFp5()(x1c, C1);   // x1 = (-B / A) * (1 + (1 / (Z²·u⁴ + Z·u²)))

    signal gx1a[5] <== SquareFp5()(x1);        // gx1 = x1²
    signal gx1b[5] <== AddFp5()(gx1a, A);      // gx1 = x1² + A
    signal gx1c[5] <== MulFp5()(gx1b, x1);     // gx1 = x1³ + A·x1
    signal gx1[5] <== AddFp5()(gx1c, B);       // gx1 = x1³ + A·x1 + B

    signal x2[5] <== MulFp5()(tv1, x1);        // x2 = Z·u²·x1
    signal tv2[5] <== MulFp5()(tv1, tv2a);     // tv2 = Z³·u⁶
    signal gx2[5] <== MulFp5()(gx1, tv2);      // gx2 = (Z·u²)³·gx1

    signal {binary} e2;
    (_, e2) <== IsSquareFp5()(gx1);

    signal x[5] <== MultiMux1(5)([x2, x1], e2); // If is_square(gx1), x = x1, else x = x2
    signal y2[5] <== MultiMux1(5)([gx2, gx1], e2); // If is_square(gx1), y2 = gx1, else y2 = gx2

    signal y[5] <== SqrtFp5()(y2); // y = sqrt(y2)

    // Fix the sign of y
    signal {binary} e3 <== SignCompareFp5()(u, y);
    signal y_neg[5] <== NegFp5()(y);

    R.x <== x;
    R.y <== MultiMux1(5)([y, y_neg], e3);
}

// Given P,R ∈ E(Fp⁵), checks R = h·P, where h is the cofactor of the curve
// It assumes P,R != 𝒪 and ord(P) > h
template ClearCofactor() {
    input PointFp5() P;
    output PointFp5() R;
}