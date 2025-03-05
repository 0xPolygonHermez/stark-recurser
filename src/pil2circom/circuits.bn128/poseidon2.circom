pragma circom 2.0.0;

include "./poseidon2_constants.circom";

template Sigma() {
    signal input in;
    signal output out;

    signal in2;
    signal in4;

    in2 <== in*in;
    in4 <== in2*in2;

    out <== in4*in;
}

template Ark(t, C, r) {
    signal input in[t];
    signal output out[t];

    for (var i=0; i<t; i++) {
        out[i] <== in[i] + C[r + i];
    }
}

template ArkP(C, r) {
    signal input in;
    signal output out;

    out <== in + C[r];
}

template MatMulM4() {
    signal input in[4];
    signal output out[4];

    signal t0, t1, t2, t3, t4, t5, t6, t7;
    t0 <== in[0] + in[1];
    t1 <== in[2] + in[3];
    t2 <== 2*in[1] + t1;
    t3 <== 2*in[3] + t0;
    t4 <== 4*t1 + t3;
    t5 <== 4*t0 + t2;
    t6 <== t3 + t5;
    t7 <== t2 + t4;

    out[0] <== t6;
    out[1] <== t5;
    out[2] <== t7;
    out[3] <== t4;
}

template MatMulExternal(t) {
    signal input in[t];
    signal output out[t];

    if(t == 2) {
        signal sum <== in[0] + in[1];
        out[0] <== in[0] + sum;
        out[1] <== in[1] + sum;
    } else if(t == 3) {
        signal sum <== in[0] + in[1] + in[2];
        out[0] <== in[0] + sum;
        out[1] <== in[1] + sum;
        out[2] <== in[2] + sum;
    } else if(t >= 4) {
        signal mat4[t \ 4][4];
        for(var i = 0; i < t \ 4; i++) {
            mat4[i] <== MatMulM4()([in[4*i], in[4*i + 1], in[4*i + 2], in[4*i + 3]]);
        }

        if(t == 4) {
            out <== mat4[0];
        } else {
            signal partial_stored[t \ 4 - 1][4];

            partial_stored[0][0] <== mat4[0][0] + mat4[1][0];
            partial_stored[0][1] <== mat4[0][1] + mat4[1][1];
            partial_stored[0][2] <== mat4[0][2] + mat4[1][2];
            partial_stored[0][3] <== mat4[0][3] + mat4[1][3];
            for(var i = 0; i < t \ 4 - 2; i++) {
                for(var j = 0; j < 4; j++) {
                    partial_stored[i + 1][j] <== partial_stored[i][j] + mat4[i + 2][j];
                }
            }

            for(var i = 0; i < t \ 4; i++) {
                for(var j = 0; j < 4; j++) {
                    out[4*i + j] <== mat4[i][j] + partial_stored[t \ 4 - 2][j];
                }
            }
        }
    }
}

template MatMulInternal(t, D) {
    signal input in[t];
    signal output out[t];

    if(t == 2) {
        signal sum <== in[0] + in[1];
        out[0] <== in[0] + sum;
        out[1] <== 2*in[1] + sum;
    } else if(t == 3) {
        signal sum <== in[0] + in[1] + in[2];
        out[0] <== in[0] + sum;
        out[1] <== in[1] + sum;
        out[2] <== 2*in[2] + sum;
    } else if(t >= 4) {
        signal sum[t - 1];
        sum[0] <== in[0] + in[1];
        for(var i = 2; i < t; i++) {
            sum[i - 1] <== sum[i - 2] + in[i];
        }

        for(var i = 0; i < t; i++) {
            out[i] <== in[i] * D[i] + sum[t - 2];
        }
    }
}


template Poseidon2(nInputs, nOuts) {
    signal input inputs[nInputs];
    signal output out[nOuts];

    var t = nInputs;
    assert(t == 2 || t == 3 || t == 4 || t == 8 || t == 12 || t == 16);
    var nRoundsF = 8;
    var nRoundsP;
    if(t == 2 || t == 3 || t == 4) {
        nRoundsP = 56;
    } else {
        nRoundsP = 57;
    }
    var C[t*nRoundsF + nRoundsP] = POSEIDON_C(t);
    var D[t] = POSEIDON_D(t);

    component sigmaF[nRoundsF][t];
    component sigmaP[nRoundsP];
    component matmul[nRoundsF + 1];
    component ark[nRoundsF];
    component arkP[nRoundsP];
    component mix[nRoundsP];

    matmul[0] = MatMulExternal(t);
    for (var j=0; j<t; j++) {
        matmul[0].in[j] <== inputs[j];
    }

    for (var r = 0; r < nRoundsF\2; r++) {
        ark[r] = Ark(t, C, r*t);
        ark[r].in <== matmul[r].out;
        for (var j = 0; j < t; j++) {
            sigmaF[r][j] = Sigma();
            sigmaF[r][j].in <== ark[r].out[j];
        }
        matmul[r+1] = MatMulExternal(t);
        for (var j=0; j<t; j++) {
            matmul[r+1].in[j] <== sigmaF[r][j].out;
        }
    }

    for (var r = 0; r < nRoundsP; r++) {
        sigmaP[r] = Sigma();
        arkP[r] = ArkP(C, t*nRoundsF\2 + r);
        if (r==0) {
            arkP[r].in <== matmul[nRoundsF\2].out[0];
        } else {
            arkP[r].in <== mix[r - 1].out[0];
        }
        sigmaP[r].in <== arkP[r].out;

        mix[r] = MatMulInternal(t, D);
        for (var j=0; j<t; j++) {
            if(j == 0) {
                mix[r].in[j] <== sigmaP[r].out;
            } else {
                if(r == 0) {
                    mix[r].in[j] <== matmul[nRoundsF\2].out[j];
                } else {
                    mix[r].in[j] <== mix[r - 1].out[j];
                }
            }
        }
    }

    for (var r = 0; r < nRoundsF\2; r++) {
        ark[r + nRoundsF\2] = Ark(t, C, nRoundsP + (nRoundsF\2 + r)*t);
        if(r == 0) {
            ark[r + nRoundsF\2].in <== mix[nRoundsP - 1].out;
        } else {
            ark[r + nRoundsF\2].in <== matmul[r + nRoundsF\2].out;
        }
        for (var j = 0; j < t; j++) {
            sigmaF[r + nRoundsF\2][j] = Sigma();
            sigmaF[r + nRoundsF\2][j].in <== ark[r + nRoundsF\2].out[j];
        }
        matmul[r + nRoundsF\2 + 1] = MatMulExternal(t);
        for (var j=0; j<t; j++) {
            matmul[r + nRoundsF\2 + 1].in[j] <== sigmaF[r + nRoundsF\2][j].out;
        }
    }

    for(var i = 0; i < nOuts; i++) {
        out[i] <== matmul[nRoundsF].out[i];
    }
}