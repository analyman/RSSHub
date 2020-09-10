const got = require('@/utils/got');
const cheerio = require('cheerio');

const max_comment_page = 4;

function get_comment_from_dom(node) {
    const user = node.find(".author > .left > a").text();
    const date = node.find(".author > .left > .stime").text();
    const is_owner = node.find(".author > .left > .post-owner").length == 1;
    const comment = "<table>" + node.find(".case").html() + "</table>";
    const light = node.find(".author > .left .ilike_icon_list > .stime").text() || "0";
    return {
        user: user,
        is_owner: is_owner,
        comments: comment,
        date: date,
        light: light,
    };
}

function get_comments($) {
    const comments = $("form > .floor").get();
    const ret = [];
    comments.forEach((node) => ret.push(get_comment_from_dom($(node))));
    return ret;
}

function get_highlight_comments($) {
    const comments = $("form .w_reply .floor").get();
    const ret = [];
    comments.forEach((node) => ret.push(get_comment_from_dom($(node))));
    return ret;
}

function get_topic($) {
    const topic = $("#tpc .floor-show .floor_box .quote-content").html();
    const author = $("#tpc .floor-show .floor_box .author .left a.u").text() || "";
    const date = $("#tpc .floor-show .floor_box .author .left .stime").text() || "";

    return {
        topic: topic,
        author: author,
        date: date
    };
}

function get_comment_html(comment) {
    msg  = "<div class='comment'>";
    msg += "<div class='comment-info'>";
    msg += "<span class='comment-user'>" + comment.user + "</span>";
    if (comment.is_owner)
        {msg += "<span class='comment-owner'>楼主</span>";}
    msg += "<span class='comment-date'>" + comment.date + "</span>";
    msg += "<span class='comment-light'>&#x1f4a1;[" + comment.light + "]</span>";
    msg += "</div>";
    msg += "<div class='comment-data'>";
    msg += comment.comments;
    msg += "</div>";
    msg += "</div>";
    return msg;
}

const rss_css = `
<style>
.f999, .subhead {
    display: none;
}

body {
    background-color: #EEE;
}

.rss {
    margin: 0em 0.5em;
}

.post-info {
    color: #666;
    background-color: #F4F2F4;
    padding: 0.2em;
    border-radius: 0.3em 0.3em 0.2em 0.2em;
    border: solid 0.1pt #212;
    margin: 0.5em 0em 2em 0em;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
}

.post-info span {
    margin: 0.2em 0.5em;
    padding: 0.2em;
}

.topic {
    margin: 0em 0.2em 0.8em 0.2em;
    padding: 0.3em;
    border-radius: 1.2em 1.5em 0em 1.5em;
    background-color: #FDFCF8;
}

.divide {
    width: 100%;
    height: 1.5pt;
    margin: 0.2em 0em;
    background-color: #222;
}

.highlight-comments, .common-comments {
    margin: 1em 0.2em 0.5em 0.2em;
    padding: 0.8em;
    border-radius: 0.9em;
}

.highlight-comments {
    background-color: #FAA;
}

.common-comments {
    background-color: #DEDEDE;
}

.comment {
    background-color: #FEFEFE;
    margin: 0.8em 0em;
    padding: 0.5em 0.4em;
    border-radius: 0em 0em 0.4em 0.4em;
}

blockquote {
    background-color: #D0D1D2;
    padding: 0.3em;
    margin: 0em;
    width: 100%;
}

.comment .comment-info {
    display: flex;
    margin: 0em 0.3em;
    flex-direction: row;
    justify-content: space-between;
    color: #555;
    font-size: small;
}

.comment .comment-info span {
    margin: 0.1em 0.2em;
}

.comment .comment-data {
    margin: 0.3em 0.4em;
}
</style>
`;

function to_rss_feed_page(topic, author, date, highlight_comments, comments) {
    msg = "<div class='rss'>";
    msg += rss_css;
    msg += "<div class='post-info'><span class='owner'>" + author + "</span>";
    msg += "<span class='date'>" + date + "</span></div>";
    msg += "<div class='topic'>" + topic + "</div>";
    msg += "<div class='divide'></div>";
    if (highlight_comments.length > 0) {
        msg += "<div class='highlight-comments'>";
        for (const comment of highlight_comments)
            {msg += get_comment_html(comment);}
        msg += "</div>";
        msg += "<div class='divide'></div>";
    }
    if (comments.length > 0) {
        msg += "<div class='common-comments'>";
        for (const comment of comments)
            {msg += get_comment_html(comment);}
        msg += "</div>";
    }
    msg += "</div>";
    return msg;
}

async function fetch_page_to_rss(base, page, max) {
    const detailResponse = await got({
        method: 'get',
        url: `${base}/${page}`
    });
    const $ = cheerio.load(detailResponse.data);
    const topic__ = get_topic($);
    const highlight_comments = get_highlight_comments($);
    const comments = get_comments($);
    const dotindex = page.lastIndexOf('.');
    const pp = dotindex != -1 ? page.substr(0, dotindex) : page;
    for (let i = 2;i <= max;i++) {
        const url = `${base}/${pp}-${i}.html`;
        const response = await got({
            method: 'get',
            url: url
        });
        const cc = cheerio.load(response.data);
        const kk = get_comments(cc);
        kk.map((v, _) => comments.push(v));
    }
    const html = to_rss_feed_page(topic__.topic, topic__.author,
                                topic__.date, highlight_comments, comments);
    return {
        html: html,
        date: topic__.date,
        author: topic__.author
    };
}

module.exports = async (ctx) => {
    const rootUrl = 'https://bbs.hupu.com';
    const abc = ctx.params.section;
    const currentUrl = `${rootUrl}/${abc}`;

    const response = await got({
        method: 'get',
        url: currentUrl,
        headers: {
            Referrer: rootUrl
        }
    });
    const $ = cheerio.load(response.data);

    const list = $('.show-list .for-list li')
        .slice(0, 20)
        .map((_, item) => {
            item = $(item);
            const a = item.find('.titlelink > a');
            const ret = {
                title: a.text(),
                link: `${rootUrl}${a.attr('href')}`.trim(),
                max: 1
            };
            const multi = item.find('.multipage a').get();
            if (multi.length > 0) {
                const last = $(multi.pop());
                ret.max = Math.min(parseInt(last.text()), max_comment_page);
            }
            return ret;
        }).get();

    const items = await Promise.all(
        list.map(
            async (item) =>
                await ctx.cache.tryGet(item.link, async () => {
                    try {
                        const i = item.link.lastIndexOf("/");
                        const page = item.link.substr(i + 1);
                        const the_get = await fetch_page_to_rss(rootUrl, page, item.max);

                        item.description = the_get.html;
                        item.author = the_get.author;
                        item.pubDate = new Date(the_get.date + ' GMT+8').toUTCString();

                        return item;
                    } catch (error) {
                        return Promise.resolve('');
                    }
                })
        )
    );

    ctx.state.data = {
        title: $('title').text(),
        link: currentUrl,
        item: items,
    };
};
