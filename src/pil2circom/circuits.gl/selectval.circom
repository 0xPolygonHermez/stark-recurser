pragma circom 2.1.0;
pragma custom_templates;

include "utils.circom";

template SelectValue(arity, nLastLevels) {
    var nBits = log2(arity);
    signal input values[arity**nLastLevels][4];
    signal input {binary}key[nLastLevels][nBits];
    signal output selected_value[4];

    var total = 0;
    var lev = arity**nLastLevels;
    for (var i = 0; i < nLastLevels; i++) {
        lev = lev/arity;
        total += lev;
    }

    component im[total];

    var index = 0;
    var current_level_index = 0;
    var last_level_index = 0;
    for (var i = 0; i < nLastLevels; i++) {
        for (var j = 0; j < (arity**(nLastLevels - i - 1)); j++) {
            im[index] = SelectValue1();
            im[index].key <== key[i];
            for (var l = 0; l < arity; l++) {
                if (i == 0) {
                    im[index].values[l] <== values[j*arity + l];
                } else {
                    im[index].values[l] <== im[last_level_index + j*arity + l].selected_value;
                }
            }
            index++;
        }
        last_level_index += current_level_index;
        current_level_index = (arity**(nLastLevels - i - 1));
    }

    selected_value <== im[total - 1].selected_value;
    
}

template custom SelectValue1() {
    signal input values[4][4];
    signal input key[2];
    signal output selected_value[4];

    var index = (key[0] + key[1]*2);
    selected_value <-- values[index];
}
