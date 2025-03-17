pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/fp5.circom";

template Neg() {
    signal input a[5];
    signal output a_neg[5] <== NegFp5()(a);
}

component main = Neg();