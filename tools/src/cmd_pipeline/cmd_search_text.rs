use async_trait::async_trait;
use clap::Args;

use super::{
    interface::{PipelineCommand, PipelineValues},
    transforms::path_glob_transform,
};

use crate::abstract_server::{AbstractServer, ErrorDetails, ErrorLayer, Result, ServerError};

/// Perform a fulltext search against our livegrep/codesearch server over gRPC.
/// This is local-only at this time.
#[derive(Debug, Args)]
pub struct SearchText {
    /// Text to search for; this will be regexp escaped.
    #[clap(value_parser)]
    text: Option<String>,

    /// Search for a regular expression.  This can't be used if `text` is used.
    #[clap(long, value_parser)]
    re: Option<String>,

    /// Constrain matching path patterns with a non-regexp path constraint that
    /// will be escaped into a regexp.
    #[clap(long, value_parser)]
    path: Option<String>,

    /// Constrain matching path patterns with a regexp.
    #[clap(long, value_parser)]
    pathre: Option<String>,

    /// Should this be case-sensitive?  By default we are case-insensitive.
    #[clap(short, long, value_parser)]
    case_sensitive: bool,

    #[clap(short, long, value_parser, default_value = "0")]
    limit: usize,
}

#[derive(Debug)]
pub struct SearchTextCommand {
    pub args: SearchText,
}

#[async_trait]
impl PipelineCommand for SearchTextCommand {
    async fn execute(
        &self,
        server: &(dyn AbstractServer + Send + Sync),
        _input: PipelineValues,
    ) -> Result<PipelineValues> {
        let re_pattern = if let Some(re) = &self.args.re {
            re.clone()
        } else if let Some(text) = &self.args.text {
            regex::escape(text)
        } else {
            return Err(ServerError::StickyProblem(ErrorDetails {
                layer: ErrorLayer::BadInput,
                message: "Missing search text or `re` pattern!".to_string(),
            }));
        };

        let pathre_pattern = if let Some(pathre) = &self.args.pathre {
            pathre.clone()
        } else if let Some(path) = &self.args.path {
            path_glob_transform(path)
        } else {
            "".to_string()
        };

        let matches = server
            .search_text(
                &re_pattern,
                !self.args.case_sensitive,
                &pathre_pattern,
                self.args.limit,
            )
            .await?;

        Ok(PipelineValues::TextMatches(matches))
    }
}
