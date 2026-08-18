export function isNextDone(value) {
    return "done" in value && value.done === true;
}
export function avatarSrc(id) {
    const slug = /^ink-\d{1,2}$/.test(id) ? id : "ink-0";
    return `/avatars/${slug}.svg`;
}
