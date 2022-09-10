use anyhow::Context;
use pest::Parser;
use pest_derive::Parser;

#[derive(Parser)]
#[grammar = "util/htmlize/htmlize.pest"]
struct CommentParser;

pub fn htmlize_comment(comment: &str) -> Result<String, anyhow::Error> {
    let mut nc = String::with_capacity(comment.len());

    let pairs = CommentParser::parse(Rule::comment, comment).context("Error parsing comment")?;
    for pair in pairs {
        let text = pair.as_str();

        match pair.as_rule() {
            Rule::newline => nc.push_str("<br>"),
            Rule::spoiler => {
                for inner_pair in pair.into_inner() {
                    match inner_pair.as_rule() {
                        Rule::spoiler_body => {
                            nc.push_str(r#"<s>"#);

                            for inner_pair in inner_pair.into_inner() {
                                match inner_pair.as_rule() {
                                    Rule::newline => nc.push_str("<br>"),
                                    Rule::spoiler_text => {
                                        html_escape::encode_text_to_string(inner_pair.as_str(), &mut nc);
                                    }
                                    _ => unreachable!(),
                                }
                            }

                            nc.push_str("</s>");
                        }
                        _ => unreachable!(),
                    }
                }
            }
            Rule::text => {
                html_escape::encode_text_to_string(pair.as_str(), &mut nc);
            }
            Rule::quote => {
                nc.push_str(r#"<span class="quote">"#);
                html_escape::encode_text_to_string(pair.as_str(), &mut nc);
                nc.push_str("</span>");
            }
            Rule::quotelink => {
                for inner_pair in pair.into_inner() {
                    match inner_pair.as_rule() {
                        Rule::post_no => {
                            nc.push_str("<a href=\"#p");
                            nc.push_str(inner_pair.as_str());
                            nc.push_str("\" class=\"quotelink\">");
                            html_escape::encode_text_to_string(text, &mut nc);
                            nc.push_str("</a>");
                        }
                        _ => unreachable!(),
                    }
                }
            }
            _ => {}
        }
    }

    Ok(nc)
}

#[test]
fn test_comment_processing() {
    fn qhtmlencode(s: &str) -> String {
        let mut ns = String::new();
        html_escape::encode_text_to_string(s, &mut ns);

        ns
    }

    let plain_text = "Just regular text";
    let quote = ">tfw no qt ptero gf";
    let quotelink = ">>123456";
    let quotelink_after_text = "Here you go: >>123456";
    let long_comment = r#">>123456
Some text.

>greentext
More text."#;
    let spoilered_text = "It's a secret to everybody: [spoiler]ur mum[/spoiler]";

    assert_eq!(htmlize_comment(plain_text).unwrap(), format!("{}", plain_text));
    assert_eq!(
        htmlize_comment(quote).unwrap(),
        format!(r#"<span class="quote">{}</span>"#, qhtmlencode(quote))
    );
    assert_eq!(
        htmlize_comment(quotelink).unwrap(),
        format!(
            r##"<a href="#p123456" class="quotelink">{}</a>"##,
            qhtmlencode(quotelink)
        )
    );
    assert_eq!(
        htmlize_comment(quotelink_after_text).unwrap(),
        r##"Here you go: <a href="#p123456" class="quotelink">&gt;&gt;123456</a>"##
    );
    assert_eq!(
        htmlize_comment(long_comment).unwrap(),
        r##"<a href="#p123456" class="quotelink">&gt;&gt;123456</a><br>Some text.<br><br><span class="quote">&gt;greentext</span><br>More text."##
    );
    assert_eq!(
        htmlize_comment(spoilered_text).unwrap(),
        r##"It's a secret to everybody: <s>ur mum</s>"##
    );
}
