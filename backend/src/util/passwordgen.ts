import * as randomstring from "randomstring";

export function generatePassword() {
    return randomstring.generate({
        length: 6,
        readable: true,
    });
}
