template VerifyFRI(nBitsExt, prevStepBits, currStepBits, nextStepBits, e0) {
    var nextStep = currStepBits - nextStepBits; 
    var step = prevStepBits - currStepBits;

    signal input {binary} queriesFRI[currStepBits];
    signal input friChallenge[3];
    signal input s_vals_curr[1<< step][3];
    signal input s_vals_next[1<< nextStep][3];
    signal input {binary} enable;

    signal sx[currStepBits];
    
    sx[0] <==  e0 *( queriesFRI[0] * (invroots(prevStepBits) -1) + 1);
    for (var i=1; i< currStepBits; i++) {
        sx[i] <== sx[i-1] *  ( queriesFRI[i] * (invroots(prevStepBits -i) -1) +1);
    }
        
    // Perform an IFFT to obtain the coefficients of the polynomial given s_vals and evaluate it 
    signal coefs[1 << step][3] <== FFT(step, 3, 1)(s_vals_curr);
    signal evalXprime[3] <== [friChallenge[0] *  sx[currStepBits - 1], friChallenge[1] * sx[currStepBits - 1], friChallenge[2] *  sx[currStepBits - 1]];
    signal evalPol[3] <== EvalPol(1 << step)(coefs, evalXprime);

    signal {binary} keys_lowValues[nextStep];
    for(var i = 0; i < nextStep; i++) { keys_lowValues[i] <== queriesFRI[i + nextStepBits]; } 
    signal lowValues[3] <== TreeSelector(nextStep, 3)(s_vals_next, keys_lowValues);

    enable * (lowValues[0] - evalPol[0]) === 0;
    enable * (lowValues[1] - evalPol[1]) === 0;
    enable * (lowValues[2] - evalPol[2]) === 0;
}

template VerifyFinalPol(lastStepBits, maxDegBits) {
    var lastStepSize = 1 << lastStepBits;
    var maxDegSize = 1 << maxDegBits;

    ///////
    // Check Degree last pol
    ///////
    signal input finalPol[lastStepSize][3];
    signal input {binary} enable;
    
    // Calculate the IFFT to get the coefficients of finalPol 
    signal lastIFFT[lastStepSize][3] <== FFT(lastStepBits, 3, 1)(finalPol);

    // Check that the degree of the final polynomial is bounded by the degree defined in the last step of the folding
    for (var k= maxDegSize; k < lastStepSize; k++) {
        for (var e=0; e<3; e++) {
            enable * lastIFFT[k][e] === 0;
        }
    }
    
    // The coefficients of lower degree can have any value
    for (var k= 0; k < maxDegSize; k++) {
        _ <== lastIFFT[k];
    }
}
