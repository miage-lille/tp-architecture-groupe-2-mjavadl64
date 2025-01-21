import { IMailer } from 'src/core/ports/mailer.interface';
import { Executable } from 'src/shared/executable';
import { User } from 'src/users/entities/user.entity';
import { IUserRepository } from 'src/users/ports/user-repository.interface';
import { IParticipationRepository } from 'src/webinars/ports/participation-repository.interface';
import { IWebinarRepository } from 'src/webinars/ports/webinar-repository.interface';
import { Participation } from 'src/webinars/entities/participation.entity';
import { Webinar } from 'src/webinars/entities/webinar.entity';
import { UserIsAlreadyRegisteredException } from '../exceptions/user-is-already-registered';
import { WebinarDatesTooSoonException } from '../exceptions/webinar-dates-too-soon';
import { WebinarTooManySeatsException } from '../exceptions/webinar-too-many-seats';
import { WebinarNotEnoughSeatsException } from '../exceptions/webinar-not-enough-seats';
import { EmailNotFoundException } from '../exceptions/email-not-found';


//inscrit un utilisateur à un webinar
//envoie un email de confirmation
//verifie que l'utilisateur n'est pas déjà inscrit
//verifie le rest des places (nombre de participants) 

type Request = {
  webinarId: string;
  user: User;
};
type Response = { success: boolean; message: string; };

export class BookSeat implements Executable<Request, Response> {
  constructor(
    private readonly participationRepository: IParticipationRepository,
    private readonly userRepository: IUserRepository,
    private readonly webinarRepository: IWebinarRepository,
    private readonly mailer: IMailer,
  ) {}
  async execute({ webinarId, user }: Request): Promise<{ success: boolean; message: string; }> {

  
    const participation = await this.participationRepository.findByWebinarId(webinarId);
    const webinar = await this.webinarRepository.findById(webinarId);

    //verifie que l'utilisateur n'est pas déjà inscrit
    if (participation.some((p) => p.props.userId === user.props.id)) {
      throw new UserIsAlreadyRegisteredException();
    }
    
    //verifie les regles de metier(webinar)
    if (webinar.isTooSoon(new Date())) {
      throw new WebinarDatesTooSoonException();
    }

    if (webinar.hasTooManySeats()) {
      throw new WebinarTooManySeatsException();
    }

    if (webinar.hasNotEnoughSeats()) {
      throw new WebinarNotEnoughSeatsException();
    }

    //inscrit un utilisateur à un webinar modulaire
    const newParticipation = new Participation({ userId: user.props.id, webinarId });
    await this.participationRepository.save(newParticipation);
    await this.sendEmailToOrganizer(webinar, user);

    return {success: true, message: 'User registered successfully'};
  }

  //envie un email pour organisateur
  async sendEmailToOrganizer(webinar: Webinar, user: User): Promise<void> {    
    const organizer = await this.userRepository.findById(webinar.props.organizerId);
    if (organizer?.props.email) {
      await this.mailer.send({
        to: organizer.props.email,
        subject: 'New participant',
        body: `New participant for webinar ${webinar.props.title}: ${user.props.email}`,
      });
    } else {
      throw new EmailNotFoundException();
    }
  }
}
