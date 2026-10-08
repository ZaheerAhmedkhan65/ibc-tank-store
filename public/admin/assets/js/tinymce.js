

const ai_request = (request, respondWith) => {
    respondWith.string((signal) =>
        fetch("/api/ai/gemini", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: request.prompt
            }),
            signal
        })
            .then(async (res) => {
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || "AI Error");
                }

                const data = await res.json();
                return data.text;
            })
    );
};

// Shared TinyMCE configuration — used for the initial page-wide init AND for
// editors created later through ibcInitTinyMCE() (e.g. rows added
// dynamically by the admin category form).
const TINY_MCE_CONFIG = {
    plugins: [
        // Core editing features
        'anchor', 'autolink', 'charmap', 'codesample', 'emoticons', 'link', 'lists', 'media', 'searchreplace', 'table', 'visualblocks', 'wordcount',
        // Your account includes a free trial of TinyMCE premium features
        // Try the most popular premium features until Jan 11, 2026:
    ],
    toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link media table mergetags | addcomment showcomments | spellcheckdialog a11ycheck typography uploadcare | align lineheight | checklist numlist bullist indent outdent | emoticons charmap | removeformat | aidialog aishortcuts',
    tinycomments_mode: 'embedded',
    tinycomments_author: 'Author name',
    mergetags_list: [{}],
    ai_request
};

let ibcTinyMceSeq = 0;

// Initialize TinyMCE on every <textarea> inside `root` (default: document)
// that doesn't have an editor yet. Safe to call repeatedly — each textarea is
// flagged synchronously before its init is queued, so it can never be
// initialized twice. Dynamically inserted rows call this on their new element
// (see views/admin/category/_form.ejs) because the page-load pass below has
// already run by then.
window.ibcInitTinyMCE = (root) => {
    if (!window.tinymce) return;
    (root || document).querySelectorAll('textarea').forEach((el) => {
        if (el.dataset.tinymceInit === '1') return;       // init queued or ready
        if (el.id && window.tinymce.get(el.id)) return;   // editor already exists
        if (!el.id) el.id = `ibc-tm-${++ibcTinyMceSeq}`;   // unique id (used for init + cleanup)
        el.dataset.tinymceInit = '1';
        window.tinymce.init({ ...TINY_MCE_CONFIG, selector: `#${el.id}` });
    });
};

// Page-load pass: turns every textarea present right now into an editor.
ibcInitTinyMCE(document);