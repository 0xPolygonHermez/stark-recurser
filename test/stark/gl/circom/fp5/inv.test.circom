pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/fp5.circom";

template Inv() {
    signal input a[5];
    signal input b[5];
    signal output a_inv[5] <== InvFp5()(a);
    signal output b_inv[5];
    (_, b_inv) <== Inv0Fp5()(b);
}

component main = Inv();