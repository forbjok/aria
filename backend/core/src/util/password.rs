use rand::{Rng, rng};

pub struct PasswordRules {
    pub alphabet: Vec<char>,
    pub password_length: usize,
}

impl PasswordRules {
    pub fn generate_password(&self) -> String {
        let alphabet = &self.alphabet;
        let alphabet_length = alphabet.len();
        let password_length = self.password_length;

        let mut rng = rng();

        let mut password_chars: Vec<&char> = Vec::with_capacity(password_length);

        for _ in 0..password_length {
            let v: usize = rng.random_range(0..alphabet_length);

            password_chars.push(&alphabet[v]);
        }

        let password: String = password_chars.into_iter().collect();

        password
    }
}

pub fn generate_simple_password(length: usize) -> String {
    let pw_rules = PasswordRules {
        alphabet: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
            .chars()
            .collect(),
        password_length: length,
    };

    pw_rules.generate_password()
}
