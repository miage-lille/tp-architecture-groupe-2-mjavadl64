import { Webinar } from 'src/webinars/entities/webinar.entity';
import { IWebinarRepository } from 'src/webinars/ports/webinar-repository.interface';

export class InMemoryWebinarRepository implements IWebinarRepository {
  constructor(public database: Webinar[] = []) {}
  async findById(webinarId: string): Promise<Webinar> {
    const webinar = this.database.find(webinar => webinar.props.id === webinarId);
    if (!webinar) {
      throw new Error('Webinar not found.');
    }
    return webinar;
  }

  async create(webinar: Webinar): Promise<void> {
    this.database.push(webinar);
  }
}
