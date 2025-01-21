import { BookSeat } from '../use-cases/book-seat';
import { IMailer } from 'src/core/ports/mailer.interface';
import { IUserRepository } from 'src/users/ports/user-repository.interface';
import { IParticipationRepository } from 'src/webinars/ports/participation-repository.interface';
import { IWebinarRepository } from 'src/webinars/ports/webinar-repository.interface';
import { Participation } from 'src/webinars/entities/participation.entity';
import { Webinar } from 'src/webinars/entities/webinar.entity';
import { User } from 'src/users/entities/user.entity';
import { UserIsAlreadyRegisteredException } from '../exceptions/user-is-already-registered';
import { WebinarDatesTooSoonException } from '../exceptions/webinar-dates-too-soon';
import { WebinarTooManySeatsException } from '../exceptions/webinar-too-many-seats';
import { WebinarNotEnoughSeatsException } from '../exceptions/webinar-not-enough-seats';
import { EmailNotFoundException } from '../exceptions/email-not-found';

class FakeParticipationRepository implements IParticipationRepository {
  private participations: Participation[] = [];
  findByWebinarId(webinarId: string): Promise<Participation[]> {
    return Promise.resolve(this.participations.filter(p => p.props.webinarId === webinarId));
  }
  save(participation: Participation): Promise<void> {
    this.participations.push(participation);
    return Promise.resolve();
  }
}

class FakeUserRepository implements IUserRepository {
  private users: User[] = [];
  findById(userId: string): Promise<User | null> {
    return Promise.resolve(this.users.find(user => user.props.id === userId) || null);
  }
  addUser(user: User): void {
    this.users.push(user);
  }
}

class FakeWebinarRepository implements IWebinarRepository {
create(webinar: Webinar): Promise<void> {
    this.webinars.push(webinar);
    return Promise.resolve();
}
  private webinars: Webinar[] = [];
  findById(webinarId: string): Promise<Webinar> {
    const webinar = this.webinars.find(webinar => webinar.props.id === webinarId);
    if (!webinar) {
      return Promise.reject(new Error('Webinar not found'));
    }
    return Promise.resolve(webinar);
  }
  addWebinar(webinar: Webinar): void {
    this.webinars.push(webinar);
  }
}

class FakeMailer implements IMailer {
  private emails: { to: string; subject: string; body: string }[] = [];
  send(email: { to: string; subject: string; body: string }): Promise<void> {
    this.emails.push(email);
    return Promise.resolve();
  }
  getEmails(): { to: string; subject: string; body: string }[] {
    return this.emails;
  }
}

describe('BookSeat', () => {
  let participationRepository: FakeParticipationRepository;
  let userRepository: FakeUserRepository;
  let webinarRepository: FakeWebinarRepository;
  let mailer: FakeMailer;
  let bookSeat: BookSeat;

  beforeEach(() => {
    participationRepository = new FakeParticipationRepository();
    userRepository = new FakeUserRepository();
    webinarRepository = new FakeWebinarRepository();
    mailer = new FakeMailer();

    bookSeat = new BookSeat(participationRepository, userRepository, webinarRepository, mailer);
  });

  it('should register a user successfully', async () => {
    const webinar = new Webinar({
      id: 'webinar1',
      organizerId: 'organizer1',
      title: 'Webinar Test',
      startDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // Start date in 4 days
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      seats: 100,
    });
    const user = new User({ id: 'user1', email: 'user@example.com', password: 'password' });
    const organizer = new User({ id: 'organizer1', email: 'organizer@example.com', password: 'password' });

    userRepository.addUser(organizer);
    webinarRepository.addWebinar(webinar);

    const result = await bookSeat.execute({ webinarId: 'webinar1', user });

    expect(result).toEqual({ success: true, message: 'User registered successfully' });
    expect(mailer.getEmails()).toContainEqual({
      to: 'organizer@example.com',
      subject: 'New participant',
      body: `New participant for webinar Webinar Test: user@example.com`,
    });
  });

  it('should throw UserIsAlreadyRegisteredException if the user is already registered', async () => {
    const user = new User({ id: 'user1', email: 'user@example.com', password: 'password' });
    const webinar = new Webinar({
      id: 'webinar1',
      organizerId: 'organizer1',
      title: 'Webinar Test',
      startDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      seats: 100,
    });

    participationRepository.save(new Participation({ userId: user.props.id, webinarId: webinar.props.id }));
    webinarRepository.addWebinar(webinar);

    await expect(bookSeat.execute({ webinarId: 'webinar1', user })).rejects.toThrow(UserIsAlreadyRegisteredException);
  });

  it('should throw WebinarDatesTooSoonException if the webinar starts in less than 3 days', async () => {
    const webinar = new Webinar({
      id: 'webinar1',
      organizerId: 'organizer1',
      title: 'Webinar Test',
      startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Starts in 2 days
      endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      seats: 100,
    });
    const user = new User({ id: 'user1', email: 'user@example.com', password: 'password' });

    webinarRepository.addWebinar(webinar);

    await expect(bookSeat.execute({ webinarId: 'webinar1', user })).rejects.toThrow(WebinarDatesTooSoonException);
  });

  it('should throw WebinarTooManySeatsException if the webinar has more than 1000 seats', async () => {
    const webinar = new Webinar({
      id: 'webinar1',
      organizerId: 'organizer1',
      title: 'Webinar Test',
      startDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      seats: 1500,
    });
    const user = new User({ id: 'user1', email: 'user@example.com', password: 'password' });

    webinarRepository.addWebinar(webinar);

    await expect(bookSeat.execute({ webinarId: 'webinar1', user })).rejects.toThrow(WebinarTooManySeatsException);
  });

  it('should throw WebinarNotEnoughSeatsException if the webinar has less than 1 seat', async () => {
    const webinar = new Webinar({
      id: 'webinar1',
      organizerId: 'organizer1',
      title: 'Webinar Test',
      startDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      seats: 0,
    });
    const user = new User({ id: 'user1', email: 'user@example.com', password: 'password' });

    webinarRepository.addWebinar(webinar);

    await expect(bookSeat.execute({ webinarId: 'webinar1', user })).rejects.toThrow(WebinarNotEnoughSeatsException);
  });

  it('should throw EmailNotFoundException if the organizer email is not found', async () => {
    const webinar = new Webinar({
      id: 'webinar1',
      organizerId: 'organizer1',
      title: 'Webinar Test',
      startDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      seats: 100,
    });
    const user = new User({ id: 'user1', email: 'user@example.com', password: 'password' });

    webinarRepository.addWebinar(webinar);

    await expect(bookSeat.execute({ webinarId: 'webinar1', user })).rejects.toThrow(EmailNotFoundException);
  });
});
