"""note.com article research & writing pipeline.

Stages:
    1. collect   - gather recent, robots.txt-permitted, well-liked articles for a tag
    2. distill   - score articles on 8 axes, keep only high scorers, extract
                   abstracted patterns ("型") without retaining article bodies
    3. write     - draft a new article from stored patterns, then self-revise
                   it twice, and track which patterns were used for later
                   correlation with the published article's like count
"""

from note_writer.config import PipelineConfig

__all__ = ["PipelineConfig"]
