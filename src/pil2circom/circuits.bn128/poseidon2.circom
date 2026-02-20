pragma circom 2.1.0;
pragma custom_templates;

include "poseidon2_constants.circom";

template Sigma() {
    signal input in;
    signal output out;

    signal in2 <== in*in;
    signal in3 <== in2*in;

    out <== in2*in3;
}

template Mix(t) {
    signal input in[t];
    signal output out[t];

    var sum = 0;
    for (var i = 0; i < t; i++) {
        sum = sum + in[i];
    }
    
    for (var i = 0; i < t; i++) {
        out[i] <== sum + in[i] * MATRIX_DIAGONAL(t, i);
    }
}

template MatMul_external(t) {
    signal input in[t];
    signal output out[t];

    if (t == 2) {
        out[0] <== 2*in[0] + in[1];
        out[1] <== 2*in[1] + in[0];
    } else if (t == 3) {
        var sum = in[0] + in[1] + in[2];
        out[0] <== 2*in[0] + in[1] + in[2];
        out[1] <== in[0] + 2*in[1] + in[2];
        out[2] <== in[0] + in[1] + 2*in[2];
    } else if (t == 4) {
        out <== MatMul_M4()(in);
    } else {
        var nBlocks = t / 4;
        signal values[t];
        component matmul[nBlocks];
        for (var i = 0; i < nBlocks; i++) {
            matmul[i] = MatMul_M4();
            matmul[i].in <== [in[4*i], in[4*i + 1], in[4*i + 2], in[4*i + 3]];
            for (var j = 0; j < 4; j++) {
                values[4*i + j] <== matmul[i].out[j];
            }
        }

        var stored[4];
        for (var i = 0; i < nBlocks; i++) {
            stored[0] = stored[0] + values[4*i];
            stored[1] = stored[1] + values[4*i + 1];
            stored[2] = stored[2] + values[4*i + 2];
            stored[3] = stored[3] + values[4*i + 3];
        }

        for (var i = 0; i < t; i++) {
            out[i] <== stored[i % 4] + values[i];
        }
    }
}


template MatMul_M4() {
    signal input in[4];
    signal output out[4];

    signal t0 <== in[0] + in[1];
    signal t1 <== in[2] + in[3];
    signal t2 <== 2*in[1] + t1;
    signal t3 <== 2*in[3] + t0;
    signal t4 <== 4*t1 + t3;
    signal t5 <== 4*t0 + t2;
    signal t6 <== t3 + t5;
    signal t7 <== t2 + t4;

    out[0] <== t6;
    out[1] <== t5;
    out[2] <== t7;
    out[3] <== t4;
}

template Poseidon2(t, nOuts) {
    signal input in[t];
    signal output out[nOuts];

    assert(t == 2 || t == 3 || t == 4 || t == 8 || t == 12 || t == 16);

    signal initial_st[t] <== MatMul_external(t)(in);

    var nRoundsP = t <= 4 ? 56 : 57;

    component matmul[8];
    component sigmaF[8][t];
    component sigmaP[nRoundsP];
    component mixP[nRoundsP];
    

    for(var r = 0; r < 4; r++) {
        for (var i=0; i < t; i++) {
            sigmaF[r][i] = Sigma();
            if (r == 0) {
                sigmaF[0][i].in <== initial_st[i] + CONSTANTS(t, i);
            } else {
                sigmaF[r][i].in <== matmul[r-1].out[i] + CONSTANTS(t, t*r + i);
            }
        }
        matmul[r] = MatMul_external(t);
        for (var i=0; i < t; i++) {
            matmul[r].in[i] <== sigmaF[r][i].out;
        }
    }

    for(var r = 0; r < nRoundsP; r++) {
        sigmaP[r] = Sigma();
        mixP[r] = Mix(t);
        if (r == 0) {
            sigmaP[0].in <== matmul[3].out[0] + CONSTANTS(t, 4*t);
            mixP[0].in[0] <== sigmaP[0].out;
            for (var i = 1; i < t; i++) {
                mixP[0].in[i] <== matmul[3].out[i];
            }
        } else {
            sigmaP[r].in <== mixP[r-1].out[0] + CONSTANTS(t, 4*t + r);
            mixP[r].in[0] <== sigmaP[r].out;
            for (var i = 1; i < t; i++) {
                mixP[r].in[i] <== mixP[r-1].out[i];
            }
        }
    }

    for(var r = 0; r < 4; r++) {
        for (var i=0; i < t; i++) {
            sigmaF[4 + r][i] = Sigma();
            if (r == 0) {
                sigmaF[4][i].in <== mixP[nRoundsP - 1].out[i] + CONSTANTS(t, 4*t + nRoundsP + i);
            } else {
                sigmaF[4 + r][i].in <== matmul[4 + r - 1].out[i] + CONSTANTS(t, (4 + r)*t + nRoundsP + i);
            }
        }
        matmul[4 + r] = MatMul_external(t);
        for (var i=0; i < t; i++) {
            matmul[4 + r].in[i] <== sigmaF[4 + r][i].out;
        }
    }

    for (var i=0; i < nOuts; i++) {
        out[i] <== matmul[7].out[i];
    }

    for (var i = nOuts; i < t; i++) {
        _ <== matmul[7].out[i];
    }
   
}

template Poseidon2_Sponge(t, nOuts) {
    signal input in[t - 1];
    signal input initialState;
    signal output out[nOuts];

    signal st[t];
    st[0] <== initialState;
    for (var i = 1; i < t; i++) {
        st[i] <== in[i - 1];
    }

    out <== Poseidon2(t, nOuts)(st);
}