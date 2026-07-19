export const rng = {
  int(n) { return Math.floor(Math.random() * n); },
  pick(arr) { return arr[this.int(arr.length)]; },
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
};
