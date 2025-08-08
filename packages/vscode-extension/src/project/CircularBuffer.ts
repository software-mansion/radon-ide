export class CircularBuffer<T> {
  private buffer: Array<T>;
  private size: number;
  private capacity: number;
  private headIndex: number;

  constructor(capacity: number) {
    this.size = 0;
    this.headIndex = 0;
    this.capacity = capacity;
    this.buffer = Array<T>(this.capacity);
  }

  public write(value: T) {
    this.buffer[this.headIndex] = value;
    this.headIndex = (this.headIndex + 1) % this.capacity;
    this.size = Math.min(this.size + 1, this.capacity);
  }

  public clear() {
    this.headIndex = 0;
    this.buffer.length = 0;
  }

  public readAll(): T[] {
    return [
      ...this.buffer.slice(this.headIndex, this.size),
      ...this.buffer.slice(0, this.headIndex),
    ];
  }
}
