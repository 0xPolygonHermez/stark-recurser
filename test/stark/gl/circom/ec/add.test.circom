pragma circom 2.2.0;

include "../../../../../src/pil2circom/circuits.gl/elliptic_curve.circom";

template ECAdd() {
    input PointFp5() P;
    input PointFp5() Q;
    output PointFp5() R <== AddECFp5()(P,Q);
}

component main = ECAdd();