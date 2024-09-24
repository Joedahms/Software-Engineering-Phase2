/**
 * @file responsiveMaintainerMetric.ts
 */

import { Scorecard } from '../scores/scorecard.js';
import { Metric } from './metric.js';

import { Octokit } from '@octokit/rest';

import dotenv from 'dotenv';
dotenv.config();

/**
 * @class ResponsiveMaintainerMetric
 *
 * Evaluates maintainers' responsiveness by analyzing issue and PR response times.
 */
export class MaintainersMetric extends Metric {

    private octokit: Octokit;

    constructor() {
        super();
        this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    }

    public async evaluate(card: Scorecard): Promise<void> {
        try {
            const sinceDate = new Date();
            sinceDate.setMonth(sinceDate.getMonth() - 1); // Last 30 days

            const issuesData = await this.octokit.issues.listForRepo({
                owner: card.owner,
                repo: card.repo,
                since: sinceDate.toISOString(),
                state: 'open',
                per_page: 100,
            });

            const issues = issuesData.data;
            if (issues.length === 0) {
                card.responsiveMaintainer = 1;
                return;
            }

            let totalResponseTime = 0;
            let responseCount = 0;

            for (const issue of issues) {
                const responseTime = await this.getFirstResponseTime(card, issue);
                if (responseTime !== null) {
                    totalResponseTime += responseTime;
                    responseCount++;
                }
            }

            if (responseCount === 0) {
                card.responsiveMaintainer = 0;
                return;
            }

            const averageResponseTime = totalResponseTime / responseCount;

            // Scoring logic based on average response time
            let responseScore = 1;
            if (averageResponseTime <= 24) {
                responseScore = 1;
            } else if (averageResponseTime <= 72) {
                responseScore = 0.7;
            } else if (averageResponseTime <= 168) {
                responseScore = 0.4;
            } else {
                responseScore = 0;
            }

            card.responsiveMaintainer = responseScore;

        } catch (error) {
            console.error('Error fetching responsiveness information:', error);
            card.responsiveMaintainer = 0;
        }
    }

    private async getFirstResponseTime(card: Scorecard, issue: any): Promise<number | null> {
        try {
            const commentsData = await this.octokit.issues.listComments({
                owner: card.owner,
                repo: card.repo,
                issue_number: issue.number,
            });

            const comments = commentsData.data;

            for (const comment of comments) {
                if (comment.user) {
                    const isCollaborator = await this.octokit.repos.checkCollaborator({
                        owner: card.owner,
                        repo: card.repo,
                        username: comment.user.login,
                    }).then(() => true).catch(() => false);
            
                    if (isCollaborator) {
                        const issueCreatedAt = new Date(issue.created_at);
                        const commentCreatedAt = new Date(comment.created_at);
                        const responseTime = (commentCreatedAt.getTime() - issueCreatedAt.getTime()) / (1000 * 60 * 60);
                        return responseTime;
                    }
                }
            }

            return null;
        } catch {
            return null;
        }
    }
}
