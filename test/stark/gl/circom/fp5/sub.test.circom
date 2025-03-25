pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/fp5.circom";

template Sub() {
    signal input a[5];
    signal input b[5];
    signal output a_sub_b[5] <== SubFp5()(a, b);
}

component main = Sub();