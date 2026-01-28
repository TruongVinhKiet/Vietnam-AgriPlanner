CREATE TABLE IF NOT EXISTS comment_reactions (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reaction_type VARCHAR(20),
    comment_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    CONSTRAINT comment_reactions_reaction_type_check CHECK (((reaction_type)::text = ANY ((ARRAY['LIKE'::character varying, 'LOVE'::character varying, 'HAHA'::character varying, 'WOW'::character varying, 'SAD'::character varying, 'ANGRY'::character varying])::text[]))),
    CONSTRAINT uk_comment_reactions_comment_user UNIQUE (comment_id, user_id),
    CONSTRAINT fk_comment_reactions_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_reactions_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id ON comment_reactions(user_id);
