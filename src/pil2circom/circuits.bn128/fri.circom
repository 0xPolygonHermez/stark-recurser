/*
    Verify that FRI polynomials are built properly
*/
template parallel VerifyFRI(prevStepBits, currStepBits, nextStepBits, e0, e1) {
    var nextStep = currStepBits - nextStepBits;
    var step = prevStepBits - currStepBits;

    signal input {binary} queriesFRI[currStepBits];
    signal input {maxNum} challengeFRIStep[3];
    signal input {maxNum} s_vals_curr[1 << step][3];
    signal input {maxNum} s_vals_next[1 << nextStep][3];
    signal input {binary} enable;

    var q = 0xFFFFFFFFFFFFFFFF;

    signal {maxNum} s_sx[currStepBits - 1];
    s_sx.maxNum = q;

    signal {maxNum} inp[currStepBits - 2];
    inp.maxNum = q;

    signal {maxNum} ina;
    signal {maxNum} inb;
    ina.maxNum = q;
    inb.maxNum = q;

    ina <== queriesFRI[0] * (e1 - e0) + e0;
    inb <== queriesFRI[1] * (invroots(prevStepBits - 1) -1) + 1;
    s_sx[0] <== GLMul()(ina, inb);
    for (var i=1; i< currStepBits - 1; i++) {
        inp[i - 1] <== queriesFRI[i + 1] * (invroots(prevStepBits - (i + 1)) -1) + 1;
        s_sx[i] <== GLMul()(s_sx[i-1], inp[i - 1]);
    }

    signal {maxNum} s_X[3]; 
    if(currStepBits > 1) {
        s_X.maxNum = s_sx.maxNum;
        s_X <== [s_sx[currStepBits - 2], 0, 0];
    } else {
        signal {maxNum} inp1 <== GLConst(e0)();
        signal {maxNum} inp2;
        inp2.maxNum = q;
        inp2 <== queriesFRI[0] * (invroots(prevStepBits) -1) + 1;

        signal {maxNum} mul <== GLMul()(inp1, inp2);
        s_X.maxNum = mul.maxNum;
        s_X <== [mul, 0, 0];
    }

    signal {maxNum} coefs[1 << step][3] <== FFT(step, 1)(s_vals_curr);
    signal {maxNum} evalXprime[3] <== GLCMul()(challengeFRIStep, s_X);
    signal {maxNum} evalPol[3] <== EvalPol(1 << step)(coefs, evalXprime);
    
    signal {binary} s_keys_lowValues[nextStep];
    for(var i = 0; i < nextStep; i++) { s_keys_lowValues[i] <== queriesFRI[i + nextStepBits]; } 
    signal {maxNum} lowValues[3] <== TreeSelector(nextStep, 3)(s_vals_next, s_keys_lowValues);

    signal {maxNum} vals[3] <== GLCSub()(evalPol, lowValues);
    signal {maxNum} normC[3] <== GLCNorm()(vals);
    
    enable * normC[0] === 0;
    enable * normC[1] === 0;
    enable * normC[2] === 0;
}

template parallel VerifyFinalPol(lastStepBits, maxDegBits) {
    var lastStepSize = 1 << lastStepBits;
    var maxDegSize = 1 << maxDegBits;

    ///////
    // Check Degree last pol
    ///////
    signal input {maxNum} finalPol[lastStepSize][3];
    signal input {binary} enable;

    // Calculate the IFFT to get the coefficients of finalPol 
    signal lastIFFT[lastStepSize][3] <== FFT(lastStepBits, 1)(finalPol);

    // Check that the degree of the final polynomial is bounded by the degree defined in the last step of the folding
    for (var k= maxDegSize; k< lastStepSize; k++) {
        for (var e=0; e<3; e++) {
            enable * lastIFFT[k][e] === 0;
        }
    }

    // The coefficients of lower degree can have any value
    for (var k= 0; k < maxDegSize; k++) {
        _ <== lastIFFT[k];
    }
}