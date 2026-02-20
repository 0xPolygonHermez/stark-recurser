pragma circom 2.1.0;

include "poseidon2.circom";

// Given a list on inputs over GL³, compute the linear hash of the list, mapping from GL³ to BN
// via the map (x,y,z) |-> x + y·2⁶⁴ + z·2¹²⁸, which is injective but not surjective;
// and hashing the resulting BN elements in chunks of ${arity} using Poseidon.
template LinearHash(nInputs, eSize, arity) {
    signal input in[nInputs][eSize];
    signal output out;

    var nElements256 = (nInputs*eSize - 1)\3 +1;

    var sAc = 0;
    var nAc =0;

    var nHashes;
    if (nElements256 == 1) {
        for (var i=0; i<nInputs; i++) {
            for (var j=0; j<eSize; j++) {
                sAc = sAc + 2**(64*nAc) * in[i][j];
                nAc ++;
            }
        }
        out <== sAc;
        nHashes = 0;
    } else {

        nHashes = (nElements256 - 1)\(arity - 1) +1;
    }

    component hash[nHashes];
   
    for (var i=0; i<nHashes; i++) {
        hash[i] = Poseidon2_Sponge(arity, 1);
    }

    var curHash =0;
    var curHashIdx = 0;

    if (nElements256 > 1) {

        for (var i=0; i<nInputs; i++) {
            for (var j=0; j<eSize; j++) {
                sAc = sAc + 2**(64*nAc) * in[i][j];
                nAc ++;
                if (nAc == 3) {
                    hash[curHash].in[curHashIdx] <== sAc;
                    sAc =0;
                    nAc =0;
                    curHashIdx ++;
                    if (curHashIdx == arity - 1) {
                        curHash++;
                        curHashIdx = 0;
                    }
                }
            }
        }
        if (nAc > 0) {
            hash[curHash].in[curHashIdx] <== sAc;
            curHashIdx ++;
            if (curHashIdx == arity - 1) {
                curHash++;
                curHashIdx = 0;
            }
        }

        if (curHashIdx > 0) {
            while (curHashIdx < arity - 1) {
                hash[curHash].in[curHashIdx] <== 0;
                curHashIdx++;
            }
        }

        for (var i=0; i<nHashes;i++) {
            if (i==0) {
                hash[i].initialState <== 0;
            } else {
                hash[i].initialState <== hash[i-1].out[0];
            }
            _ <== hash[i].out;
        }

        _ <== hash[nHashes - 1].out;
        out <== hash[nHashes - 1].out[0];
    }
}

