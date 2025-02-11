import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  Param,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { LabGeneratorService } from './lab.service';

@Controller('labs')
export class LabGeneratorController {
  constructor(private readonly labGeneratorService: LabGeneratorService) {}

  @Post()
  async createLab(
    @Body()
    body: {
      gradeLevel: string;
      subject: string;
      duration: string;
      context: string;
      standards?: string;
    },
    @Req() req: any,
  ) {
    const user = req.user;
    const userId = user.sub;

    try {
      const lab = await this.labGeneratorService.createLab(userId, body);
      return { lab };
    } catch (error) {
      console.error('Error creating lab:', error);
      throw new InternalServerErrorException('Failed to create lab');
    }
  }

  @Get('/:id')
  async getLabById(@Param('id') id: string) {
    try {
      const lab = await this.labGeneratorService.getLabById(id);
      return lab;
    } catch (error) {
      console.error('Error fetching lab:', error);
      throw new NotFoundException(`Lab with ID ${id} not found`);
    }
  }
}
