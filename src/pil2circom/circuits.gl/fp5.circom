pragma circom 2.2.0;

/*
    Circuits that implement operations for the extension field Fp⁵ = F[X]/(X⁵-3)
*/

// Given a,b,c ∈ Fp⁵, checks c == a+b
// Cost: 5 (5 add)
template AddFp5() {
    signal input a[5];
    signal input b[5];
    signal output c[5];

    for (var i = 0; i < 5; i++) {
        c[i] <== a[i] + b[i];
    }
}

// Given a,b,c ∈ Fp⁵, checks c == a-b
// Cost: 5 (5 sub)
template SubFp5() {
    signal input a[5];
    signal input b[5];
    signal output c[5];

    for (var i = 0; i < 5; i++) {
        c[i] <== a[i] - b[i];
    }
}


// Given a,b,c ∈ Fp⁵, checks c == a·b
// Cost: 49 (25 mul, 20 add, 4 scalar mul)
template MulFp5() {
    signal input a[5];
    signal input b[5];
    signal output c[5];

    signal a1b4 <== a[1]*b[4];
    signal a2b3 <== a[2]*b[3];
    signal a3b2 <== a[3]*b[2];
    signal a4b1 <== a[4]*b[1];
    signal a1b0 <== a[1]*b[0];
    signal a2b4 <== a[2]*b[4];
    signal a3b3 <== a[3]*b[3];
    signal a4b2 <== a[4]*b[2];
    signal a1b1 <== a[1]*b[1];
    signal a2b0 <== a[2]*b[0];
    signal a3b4 <== a[3]*b[4];
    signal a4b3 <== a[4]*b[3];
    signal a1b2 <== a[1]*b[2];
    signal a2b1 <== a[2]*b[1];
    signal a3b0 <== a[3]*b[0];
    signal a4b4 <== a[4]*b[4];
    signal a1b3 <== a[1]*b[3];
    signal a2b2 <== a[2]*b[2];
    signal a3b1 <== a[3]*b[1];
    signal a4b0 <== a[4]*b[0];
    c[0] <== a[0]*b[0] + 3*(a1b4 + a2b3 + a3b2 + a4b1);
    c[1] <== a[0]*b[1] + a1b0 + 3*(a2b4 + a3b3 + a4b2);
    c[2] <== a[0]*b[2] + a1b1 + a2b0 + 3*(a3b4 + a4b3);
    c[3] <== a[0]*b[3] + a1b2 + a2b1 + a3b0 + 3*(a4b4);
    c[4] <== a[0]*b[4] + a1b3 + a2b2 + a3b1 + a4b0;
}

// Given a,c ∈ Fp⁵, checks c == a²
// Cost: 34 (15 mul, 10 add, 9 scalar mul)
template SquareFp5() {
    signal input a[5];
    signal output c[5];

    signal a1a4 <== a[1]*a[4];
    signal a2a3 <== a[2]*a[3];
    signal a2a4 <== a[2]*a[4];
    signal a3a3 <== a[3]*a[3];
    signal a1a1 <== a[1]*a[1];
    signal a3a4 <== a[3]*a[4];
    signal a1a2 <== a[1]*a[2];
    signal a4a4 <== a[4]*a[4];
    signal a1a3 <== a[1]*a[3];
    signal a2a2 <== a[2]*a[2];
    c[0] <== a[0]*a[0] + 6*(a1a4 + a2a3);
    c[1] <== 2*a[0]*a[1] + 3*(2*a2a4 + a3a3);
    c[2] <== 2*a[0]*a[2] + a1a1 + 6*a3a4;
    c[3] <== 2*(a[0]*a[3] + a1a2) + 3*a4a4;
    c[4] <== 2*(a[0]*a[4] + a1a3) + a2a2;
}

// Given NON-ZERO a,c ∈ Fp⁵, checks c == 1/a
// Cost: 126 (72 mul, 44 add, 9 scalar mul, 1 div)
template InvFp5() {
    signal input a[5];
    signal output c[5];

    // Get the inverse of a
    c <-- get_inverse_fp5(a);

    // Check that a·c == 1
    signal ac[5] <== MulFp5()(a, c);
    ac === [1, 0, 0, 0, 0];
}

// Given a,c ∈ Fp⁵ and NON-ZERO b ∈ Fp⁵, checks c == a/b
// Cost: 175 (97 mul, 64 add, 13 scalar mul, 1 div)
template DivFp5() {
    signal input a[5];
    signal input b[5];
    signal output c[5];

    // Get the inverse of b
    signal b_inv[5] <== InvFp5()(b);

    // Check that c == a·b^(-1)
    for (var i = 0; i < 5; i++) {
        c[i] <== a[i] * b_inv[i];
    }
}

// Helper functions

// Given a,b ∈ Fp⁵, computes c := a+b ∈ Fp⁵
function add_fp5(a, b) {
    var c[5];
    for (var i = 0; i < 5; i++) {
        c[i] = a[i] + b[i];
    }
    return c;
}

// Given a,b ∈ Fp⁵, computes c := a·b ∈ Fp⁵
function mul_fp5(a, b) {
    var c[5];

    c[0] = a[0]*b[0] + 3*(a[1]*b[4] + a[2]*b[3] + a[3]*b[2] + a[4]*b[1]);
    c[1] = a[0]*b[1] + a[1]*b[0] + 3*(a[2]*b[4] + a[3]*b[3] + a[4]*b[2]);
    c[2] = a[0]*b[2] + a[1]*b[1] + a[2]*b[0] + 3*(a[3]*b[4] + a[4]*b[3]);
    c[3] = a[0]*b[3] + a[1]*b[2] + a[2]*b[1] + a[3]*b[0] + 3*(a[4]*b[4]);
    c[4] = a[0]*b[4] + a[1]*b[3] + a[2]*b[2] + a[3]*b[1] + a[4]*b[0];

    return c;
}

// Given a ∈ Fp⁵, compute c := aᵖ ∈ Fp⁵
// Cost: 4 (4 mul)
function first_frobenius(a) {
    var c[5];

    c[0] = a[0];
    c[1] = a[1] * 1041288259238279555;
    c[2] = a[2] * 15820824984080659046;
    c[3] = a[3] * 211587555138949697;
    c[4] = a[4] * 1373043270956696022;

    return c;
}

// Given a ∈ Fp⁵, compute c := aᵖ･ᵖ ∈ Fp⁵
// Cost: 4 (4 mul)
function second_frobenius(a) {
    var c[5];

    c[0] = a[0];
    c[1] = a[1] * 15820824984080659046;
    c[2] = a[2] * 1373043270956696022;
    c[3] = a[3] * 1041288259238279555;
    c[4] = a[4] * 211587555138949697;

    return c;
}

// Given NON-ZERO a ∈ Fp⁵, compute c := 1/a ∈ Fp⁵
// as 1/a = a^(x-1) / a^x, where x = p⁴ + p³ + p² + p + 1
// Cost: 126 (72 mul, 44 add, 9 scalar mul, 1 div)
function get_inverse_fp5(a) {
    var c[5];

    var t0[5] = mul_fp5(second_frobenius(a), first_frobenius(a)); // a^(p² + p)
    var t1[5] = second_frobenius(t0);                             // a^(p⁴ + p³)
    var t2[5] = mul_fp5(t0, t1);                                  // a^(p⁴ + p³ + p² + p)

    var t3 = a[0] * t2[0] + 3 * (a[1] * t2[4] + a[2] * t2[3] + a[3] * t2[2] + a[4] * t2[1]); // a^x

    var t4 = 1 / t3; // 1 / a^x
    // var t4 =  (t3 != 0) ? 1 / t3 : 0;

    // a^(x-1) * a^(-x)
    for (var i = 0; i < 5; i++) {
        c[i] = t2[i] * t4;
    }

    return c;
}